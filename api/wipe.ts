/**
 * Unified wipe endpoint for destructive maintenance operations.
 * 
 * Supports filtering by scope (all, department, course) via query/body params:
 * - year: Academic year (defaults to current)
 * - department: Department slug (optional, required for course-level filtering)
 * - course: Course slug (optional, requires department)
 * 
 * Wipe categories and their hierarchical data:
 * - user: Firebase Auth users + Firestore users collection group
 * - calendar: Calendar documents at all hierarchy levels
 * - event: Events subcollection under calendars
 * - group: Groups with all subcollections (audits, expertRequests, panelComments, proposals, join)
 * - thesis: Thesis documents with stages, chapters, submissions, chats
 * - file: Files in Firestore (submissions, chats) + Firebase Storage
 * - audit: Audit documents under groups and users
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, errorResponse, successResponse } from '../utils/utils.js';
import { authenticate } from '../utils/auth.js';
import { auth, firestore } from '../utils/firebase.js';
import { getError } from '../utils/errorUtils.js';
import admin from 'firebase-admin';

const FIRESTORE_BATCH_LIMIT = 500;
const AUTH_BATCH_LIMIT = 1000;
const VALID_CATEGORIES = [
    'audit',
    'calendar',
    'event',
    'file',
    'group',
    'thesis',
    'user',
] as const;

type WipeCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Scope filter for wipe operations
 */
interface WipeScope {
    year: string;
    department?: string;
    course?: string;
}

interface FirestoreWipeResult {
    deleted: number;
    batches: number;
}

interface AuthWipeResult {
    success: number;
    failed: number;
    errors: { uid: string; message: string }[];
}

interface StorageWipeResult {
    deleted: number;
    failed: number;
    errors: string[];
}

interface CategoryOutcome {
    data: Record<string, unknown>;
    message: string;
}

/**
 * Get current academic year (defaults to current calendar year with format like "2024-2025")
 */
function getDefaultYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Academic year starts in August (month 7 = August)
    if (month >= 7) {
        return `${year}-${year + 1}`;
    }
    return `${year - 1}-${year}`;
}

/**
 * Type guard for validating wipe categories.
 */
function isWipeCategory(value: string): value is WipeCategory {
    return (VALID_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Sanitize path segment for Firestore paths
 */
function sanitizePathSegment(value: string | undefined, fallback: string): string {
    if (!value) return fallback;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

/**
 * Delete every document from the provided Firestore collection using batched deletes.
 * @param collectionPath Full path to the collection to wipe.
 * @param batchSize Maximum number of documents to delete per batch commit.
 */
async function wipeFirestoreCollection(
    collectionPath: string,
    batchSize: number = FIRESTORE_BATCH_LIMIT,
): Promise<FirestoreWipeResult> {
    let deleted = 0;
    let batches = 0;

    while (true) {
        const snapshot = await firestore.collection(collectionPath).limit(batchSize).get();
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
 * using batched deletes, optionally filtered by path prefix.
 * @param subcollectionName Name of the subcollection to wipe across all paths.
 * @param pathPrefix Optional path prefix to filter documents (e.g., "year/2024-2025/departments/cs")
 * @param batchSize Maximum number of documents to delete per batch commit.
 */
async function wipeFirestoreCollectionGroup(
    subcollectionName: string,
    pathPrefix?: string,
    batchSize: number = FIRESTORE_BATCH_LIMIT,
): Promise<FirestoreWipeResult> {
    let deleted = 0;
    let batches = 0;

    while (true) {
        let query = firestore.collectionGroup(subcollectionName).limit(batchSize);
        const snapshot = await query.get();

        if (snapshot.empty) {
            break;
        }

        // Filter by path prefix if provided
        const docsToDelete = pathPrefix
            ? snapshot.docs.filter(doc => doc.ref.path.startsWith(pathPrefix))
            : snapshot.docs;

        if (docsToDelete.length === 0) {
            // If we filtered out all docs but snapshot wasn't empty,
            // we need to skip these and continue (but avoid infinite loop)
            if (snapshot.docs.length < batchSize) {
                break;
            }
            continue;
        }

        const batch = firestore.batch();
        docsToDelete.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();

        deleted += docsToDelete.length;
        batches += 1;

        // If we're filtering and got fewer docs than we filtered, might need to continue
        if (pathPrefix && docsToDelete.length < snapshot.docs.length) {
            // There might be more docs after these ones
            continue;
        }
    }

    return { deleted, batches };
}

/**
 * Delete every Firebase Auth user, aggregating successes and failures.
 * Note: Auth users cannot be filtered by department/course - this is global.
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
 * Delete files from Firebase Storage based on path prefix.
 * Storage paths: {year}/{department}/{course}/{group}/...
 */
async function wipeStorageFiles(scope: WipeScope): Promise<StorageWipeResult> {
    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
        const bucket = admin.storage().bucket();
        const { year, department, course } = scope;

        // Build storage path prefix
        let prefix = year;
        if (department) {
            prefix += `/${sanitizePathSegment(department, 'general')}`;
            if (course) {
                prefix += `/${sanitizePathSegment(course, 'common')}`;
            }
        }

        // List and delete files with the prefix
        const [files] = await bucket.getFiles({ prefix });

        for (const file of files) {
            try {
                await file.delete();
                deleted++;
            } catch (error) {
                failed++;
                const { message } = getError(error, 'Failed to delete file');
                errors.push(`${file.name}: ${message}`);
            }
        }
    } catch (error) {
        const { message } = getError(error, 'Failed to list storage files');
        errors.push(message);
    }

    return { deleted, failed, errors };
}

/**
 * Wipe groups with all their subcollections (audits, expertRequests, panelComments, proposals, join, thesis)
 */
async function wipeGroupsWithSubcollections(scope: WipeScope): Promise<FirestoreWipeResult> {
    const { year, department, course } = scope;
    let deleted = 0;
    let batches = 0;

    // Build path prefix for filtering
    let pathPrefix = `year/${year}`;
    if (department) {
        pathPrefix += `/departments/${sanitizePathSegment(department, 'general')}`;
        if (course) {
            pathPrefix += `/courses/${sanitizePathSegment(course, 'common')}`;
        }
    }

    // Subcollections to wipe under groups
    const groupSubcollections = [
        'audits',
        'expertRequests',
        'panelComments',
        'proposals',
        'join',
        'configuration',
        'calendar',
    ];

    // Wipe group subcollections first
    for (const subcollection of groupSubcollections) {
        const result = await wipeFirestoreCollectionGroup(subcollection, pathPrefix);
        deleted += result.deleted;
        batches += result.batches;
    }

    // Wipe thesis and its subcollections
    const thesisResult = await wipeThesisWithSubcollections(scope);
    deleted += thesisResult.deleted;
    batches += thesisResult.batches;

    // Finally wipe the groups themselves
    const groupsResult = await wipeFirestoreCollectionGroup('groups', pathPrefix);
    deleted += groupsResult.deleted;
    batches += groupsResult.batches;

    return { deleted, batches };
}

/**
 * Wipe theses with all their subcollections (stages, chapters, submissions, chats, terminal)
 */
async function wipeThesisWithSubcollections(scope: WipeScope): Promise<FirestoreWipeResult> {
    const { year, department, course } = scope;
    let deleted = 0;
    let batches = 0;

    // Build path prefix for filtering
    let pathPrefix = `year/${year}`;
    if (department) {
        pathPrefix += `/departments/${sanitizePathSegment(department, 'general')}`;
        if (course) {
            pathPrefix += `/courses/${sanitizePathSegment(course, 'common')}`;
        }
    }

    // Wipe nested subcollections first (deepest first)
    const thesisSubcollections = [
        'chats',           // deepest: under submissions
        'submissions',     // under chapters
        'chapters',        // under stages
        'terminal',        // under stages
        'stages',          // under thesis
    ];

    for (const subcollection of thesisSubcollections) {
        const result = await wipeFirestoreCollectionGroup(subcollection, pathPrefix);
        deleted += result.deleted;
        batches += result.batches;
    }

    // Finally wipe the thesis documents
    const thesisResult = await wipeFirestoreCollectionGroup('thesis', pathPrefix);
    deleted += thesisResult.deleted;
    batches += thesisResult.batches;

    return { deleted, batches };
}

/**
 * Wipe audits at all hierarchy levels (group audits and user audits)
 */
async function wipeAudits(scope: WipeScope): Promise<FirestoreWipeResult> {
    const { year, department, course } = scope;
    let deleted = 0;
    let batches = 0;

    // Build path prefix for filtering
    let pathPrefix = `year/${year}`;
    if (department) {
        pathPrefix += `/departments/${sanitizePathSegment(department, 'general')}`;
        if (course) {
            pathPrefix += `/courses/${sanitizePathSegment(course, 'common')}`;
        }
    }

    // Wipe all audits subcollections (under groups and users at all levels)
    const result = await wipeFirestoreCollectionGroup('audits', pathPrefix);
    deleted += result.deleted;
    batches += result.batches;

    return { deleted, batches };
}

/**
 * Wipe calendars and their events at all hierarchy levels
 */
async function wipeCalendars(scope: WipeScope): Promise<FirestoreWipeResult> {
    const { year, department, course } = scope;
    let deleted = 0;
    let batches = 0;

    let pathPrefix = `year/${year}`;
    if (department) {
        pathPrefix += `/departments/${sanitizePathSegment(department, 'general')}`;
        if (course) {
            pathPrefix += `/courses/${sanitizePathSegment(course, 'common')}`;
        }
    }

    // Wipe events first (subcollection under calendar)
    const eventsResult = await wipeFirestoreCollectionGroup('events', pathPrefix);
    deleted += eventsResult.deleted;
    batches += eventsResult.batches;

    // Then wipe calendar documents
    const calendarsResult = await wipeFirestoreCollectionGroup('calendar', pathPrefix);
    deleted += calendarsResult.deleted;
    batches += calendarsResult.batches;

    return { deleted, batches };
}

/**
 * Wipe events only (preserving calendar documents)
 */
async function wipeEvents(scope: WipeScope): Promise<FirestoreWipeResult> {
    const { year, department, course } = scope;

    let pathPrefix = `year/${year}`;
    if (department) {
        pathPrefix += `/departments/${sanitizePathSegment(department, 'general')}`;
        if (course) {
            pathPrefix += `/courses/${sanitizePathSegment(course, 'common')}`;
        }
    }

    return wipeFirestoreCollectionGroup('events', pathPrefix);
}

/**
 * Wipe file references in Firestore (submissions, chats) and optionally storage
 */
async function wipeFiles(scope: WipeScope): Promise<{
    firestoreResult: FirestoreWipeResult;
    storageResult: StorageWipeResult;
}> {
    const { year, department, course } = scope;

    let pathPrefix = `year/${year}`;
    if (department) {
        pathPrefix += `/departments/${sanitizePathSegment(department, 'general')}`;
        if (course) {
            pathPrefix += `/courses/${sanitizePathSegment(course, 'common')}`;
        }
    }

    // Wipe file-related subcollections (submissions contain file metadata)
    let deleted = 0;
    let batches = 0;

    // Wipe chats (may contain attachments)
    const chatsResult = await wipeFirestoreCollectionGroup('chats', pathPrefix);
    deleted += chatsResult.deleted;
    batches += chatsResult.batches;

    // Wipe submissions (contain file attachments)
    const submissionsResult = await wipeFirestoreCollectionGroup('submissions', pathPrefix);
    deleted += submissionsResult.deleted;
    batches += submissionsResult.batches;

    // Wipe storage files
    const storageResult = await wipeStorageFiles(scope);

    return {
        firestoreResult: { deleted, batches },
        storageResult,
    };
}

/**
 * Execute the destructive wipe for the requested category.
 * @param category The category to wipe.
 * @param scope The scope filter (year, department, course).
 */
async function handleCategoryWipe(category: WipeCategory, scope: WipeScope): Promise<CategoryOutcome> {
    const scopeDesc = scope.course
        ? `${scope.department}/${scope.course}`
        : scope.department
            ? scope.department
            : 'all';

    switch (category) {
        case 'user': {
            // Users: wipe Firestore users collection group + Firebase Auth (Auth is global)
            const pathPrefix = `year/${scope.year}`;
            const firestoreResult = await wipeFirestoreCollectionGroup('users', pathPrefix);
            const authResult = await wipeAuthUsers();

            return {
                data: {
                    scope: scopeDesc,
                    firestoreDeleted: firestoreResult.deleted,
                    firestoreBatches: firestoreResult.batches,
                    authDeleted: authResult.success,
                    authFailed: authResult.failed,
                    authErrors: authResult.errors,
                },
                message: `Users wiped successfully (scope: ${scopeDesc})`,
            };
        }

        case 'calendar': {
            const result = await wipeCalendars(scope);
            return {
                data: {
                    scope: scopeDesc,
                    deleted: result.deleted,
                    batches: result.batches,
                },
                message: `Calendars and events wiped successfully (scope: ${scopeDesc})`,
            };
        }

        case 'event': {
            const result = await wipeEvents(scope);
            return {
                data: {
                    scope: scopeDesc,
                    deleted: result.deleted,
                    batches: result.batches,
                },
                message: `Events wiped successfully (scope: ${scopeDesc})`,
            };
        }

        case 'group': {
            const result = await wipeGroupsWithSubcollections(scope);
            return {
                data: {
                    scope: scopeDesc,
                    deleted: result.deleted,
                    batches: result.batches,
                },
                message: `Groups wiped successfully (scope: ${scopeDesc})`,
            };
        }

        case 'thesis': {
            const result = await wipeThesisWithSubcollections(scope);
            return {
                data: {
                    scope: scopeDesc,
                    deleted: result.deleted,
                    batches: result.batches,
                },
                message: `Theses wiped successfully (scope: ${scopeDesc})`,
            };
        }

        case 'file': {
            const { firestoreResult, storageResult } = await wipeFiles(scope);
            return {
                data: {
                    scope: scopeDesc,
                    firestoreDeleted: firestoreResult.deleted,
                    firestoreBatches: firestoreResult.batches,
                    storageDeleted: storageResult.deleted,
                    storageFailed: storageResult.failed,
                    storageErrors: storageResult.errors.length > 0 ? storageResult.errors.slice(0, 10) : undefined,
                },
                message: `Files wiped successfully (scope: ${scopeDesc})`,
            };
        }

        case 'audit': {
            const result = await wipeAudits(scope);
            return {
                data: {
                    scope: scopeDesc,
                    deleted: result.deleted,
                    batches: result.batches,
                },
                message: `Audits wiped successfully (scope: ${scopeDesc})`,
            };
        }

        default: {
            // This should never happen due to type checking
            const exhaustiveCheck: never = category;
            throw new Error(`Unhandled category: ${exhaustiveCheck}`);
        }
    }
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

    const bodyObj = requestBody && typeof requestBody === 'object'
        ? requestBody as Record<string, unknown>
        : {};

    // Extract category
    const bodyCategory = bodyObj.category;
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

    // Extract scope parameters (year, department, course)
    const extractParam = (key: string): string | undefined => {
        const bodyVal = bodyObj[key];
        if (typeof bodyVal === 'string' && bodyVal.trim().length > 0) {
            return bodyVal.trim();
        }
        const queryVal = req.query?.[key];
        if (typeof queryVal === 'string' && queryVal.trim().length > 0) {
            return queryVal.trim();
        }
        if (Array.isArray(queryVal) && queryVal[0]) {
            return String(queryVal[0]).trim();
        }
        return undefined;
    };

    const scope: WipeScope = {
        year: extractParam('year') ?? getDefaultYear(),
        department: extractParam('department'),
        course: extractParam('course'),
    };

    // Validate: course requires department
    if (scope.course && !scope.department) {
        return errorResponse(res, 'Course filter requires department to be specified', 400);
    }

    try {
        const { data, message } = await handleCategoryWipe(normalizedCategory, scope);
        return successResponse(res, data, message);
    } catch (error: unknown) {
        const { message } = getError(error, `Unable to wipe ${normalizedCategory}`);
        console.error(`Wipe failed for category "${normalizedCategory}" (scope: ${JSON.stringify(scope)}):`, error);
        return errorResponse(res, message, 500);
    }
}
