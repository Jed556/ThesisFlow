/**
 * Firestore utilities for file metadata management
 * Files are stored within submission documents following the hierarchical structure:
 * year/{year}/departments/{dept}/courses/{course}/groups/{group}/thesis/{thesis}/stages/{stage}/chapters/{chapter}/submissions/{submission}
 * 
 * Submission documents contain file metadata directly on the document (not in a files[] array).
 */

import { collection, doc, getDoc, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { FileAttachment } from '../../../types/file';
import type { ChapterSubmissionStatus, ExpertApprovalState, ThesisStageName } from '../../../types/thesis';
import { THESIS_STAGE_SLUGS } from '../../../config/firestore';
import { buildSubmissionsCollectionPath, buildSubmissionDocPath } from './paths';
import { devLog } from '../../devUtils';

// ============================================================================
// Types
// ============================================================================

/**
 * Context required for file operations within the hierarchical structure
 */
export interface FileQueryContext {
    year: string;
    department: string;
    course: string;
    groupId: string;
    thesisId: string;
    stage: ThesisStageName;
    chapterId: string;
}

/**
 * Options for file listener callbacks
 */
export interface FileListenerOptions {
    onData: (files: FileAttachment[]) => void;
    onError?: (error: Error) => void;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Firestore stage documents use slugified IDs. Normalize incoming stage names
 * so callers can provide human-readable ThesisStageName values.
 */
function normalizeStageKey(stage: ThesisStageName): string {
    return THESIS_STAGE_SLUGS[stage] ?? stage
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function resolveSubmissionsCollectionPath(ctx: FileQueryContext): string {
    return buildSubmissionsCollectionPath(
        ctx.year,
        ctx.department,
        ctx.course,
        ctx.groupId,
        ctx.thesisId,
        normalizeStageKey(ctx.stage),
        String(ctx.chapterId),
    );
}

function resolveSubmissionDocPath(ctx: FileQueryContext, submissionId: string): string {
    return buildSubmissionDocPath(
        ctx.year,
        ctx.department,
        ctx.course,
        ctx.groupId,
        ctx.thesisId,
        normalizeStageKey(ctx.stage),
        String(ctx.chapterId),
        submissionId,
    );
}

// ============================================================================
// Metadata Helpers
// ============================================================================

/**
 * Derive submission status from expertApprovals array
 * Status is not stored separately - it's derived from the approval entries
 * @param expertApprovals - Array of expert approvals/decisions
 * @param requiredRoles - Roles that need to approve (defaults to adviser + editor)
 */
function deriveStatusFromExpertApprovals(
    expertApprovals: ExpertApprovalState | undefined,
    requiredRoles: ('adviser' | 'editor' | 'statistician')[] = ['adviser', 'editor']
): ChapterSubmissionStatus {
    if (!expertApprovals || !Array.isArray(expertApprovals) || expertApprovals.length === 0) {
        return 'under_review';
    }

    // Check if any role requested revision
    const hasRevisionRequest = expertApprovals.some((a) => a.decision === 'revision_required');
    if (hasRevisionRequest) {
        return 'revision_required';
    }

    // Check if all required roles have approved
    const allApproved = requiredRoles.every((role) =>
        expertApprovals.some((a) =>
            a.role === role && (a.decision === 'approved' || a.decision === undefined)
        )
    );
    if (allApproved) {
        return 'approved';
    }

    return 'under_review';
}

function coerceString(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
}

function deriveNameFromUrl(url: string, fallbackId: string): string {
    try {
        const parsed = new URL(url);
        const pathname = decodeURIComponent(parsed.pathname);
        const segments = pathname.split('/');
        const last = segments.pop() ?? '';
        if (last.includes('.')) {
            return last.split('?')[0] || `submission-${fallbackId}`;
        }
    } catch {
        // Ignore URL parsing errors and fall back to submission ID
    }
    const raw = url.split('?')[0];
    const tail = raw.substring(raw.lastIndexOf('/') + 1);
    return tail || `submission-${fallbackId}`;
}

function extractExtension(value?: string): string | undefined {
    if (!value) {
        return undefined;
    }
    const cleaned = value.split('?')[0];
    const dotIndex = cleaned.lastIndexOf('.');
    if (dotIndex === -1 || dotIndex === cleaned.length - 1) {
        return undefined;
    }
    return cleaned.substring(dotIndex + 1).toLowerCase();
}

function guessMimeType(extension?: string): string | undefined {
    switch (extension) {
        case 'pdf':
            return 'application/pdf';
        case 'doc':
            return 'application/msword';
        case 'docx':
            return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case 'ppt':
            return 'application/vnd.ms-powerpoint';
        case 'pptx':
            return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        case 'xls':
            return 'application/vnd.ms-excel';
        case 'xlsx':
            return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        default:
            return undefined;
    }
}

function normalizeTimestampValue(value: unknown): string | undefined {
    if (!value) {
        return undefined;
    }
    if (typeof value === 'string') {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }
    if (value instanceof Timestamp) {
        return value.toDate().toISOString();
    }
    if (typeof value === 'object' && 'toDate' in (value as { toDate?: () => Date })) {
        try {
            return (value as { toDate?: () => Date }).toDate?.()?.toISOString();
        } catch {
            return undefined;
        }
    }
    return undefined;
}

function parseChapterId(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function buildFileAttachment(
    primary: Record<string, unknown>,
    fallback: Record<string, unknown>,
    submissionId: string
): FileAttachment | null {
    const url = coerceString(primary.url) ?? coerceString(fallback.url);
    if (!url) {
        return null;
    }

    const explicitName = coerceString(primary.name)
        ?? coerceString(primary.fileName)
        ?? coerceString(fallback.name)
        ?? coerceString(fallback.fileName);
    const name = explicitName ?? deriveNameFromUrl(url, submissionId);

    const extension = extractExtension(name) ?? extractExtension(url);
    const type = coerceString(primary.type)
        ?? coerceString(fallback.type)
        ?? extension
        ?? 'document';
    const mimeType = coerceString(primary.mimeType)
        ?? coerceString(fallback.mimeType)
        ?? guessMimeType(extension);

    const rawSize = primary.size ?? fallback.size;
    const size = typeof rawSize === 'number'
        ? rawSize.toString()
        : coerceString(rawSize) ?? '0';

    const uploadDate = normalizeTimestampValue(primary.uploadDate)
        ?? normalizeTimestampValue(fallback.uploadDate)
        ?? normalizeTimestampValue(fallback.submittedAt)
        ?? normalizeTimestampValue(fallback.createdAt)
        ?? new Date().toISOString();

    const author = coerceString(primary.author)
        ?? coerceString(fallback.author)
        ?? coerceString(fallback.submittedBy)
        ?? '';

    const thesisId = coerceString(primary.thesisId) ?? coerceString(fallback.thesisId);
    const groupId = coerceString(primary.groupId) ?? coerceString(fallback.groupId);
    const chapterId = parseChapterId(primary.chapterId ?? fallback.chapterId);
    const chapterStage = (primary.chapterStage ?? fallback.chapterStage) as ThesisStageName | undefined;
    const category = (primary.category ?? fallback.category ?? 'submission') as FileAttachment['category'];

    // Extract expert approvals from the submission document
    const expertApprovals = (fallback.expertApprovals ?? primary.expertApprovals) as ExpertApprovalState | undefined;

    // Check if there's a stored submissionStatus (for draft status)
    const storedStatus = coerceString(fallback.submissionStatus ?? primary.submissionStatus) as ChapterSubmissionStatus | undefined;

    // Use stored status if 'draft', otherwise derive from expertApprovals
    const submissionStatus = storedStatus === 'draft'
        ? 'draft'
        : deriveStatusFromExpertApprovals(expertApprovals);

    // Always use the Firestore submission doc ID to ensure matching with ChapterSubmissionEntry
    return {
        id: submissionId,
        name,
        url,
        mimeType,
        type,
        size,
        category,
        uploadDate,
        thesisId: thesisId ?? undefined,
        groupId: groupId ?? undefined,
        chapterId,
        chapterStage,
        author,
        metadata: (primary.metadata ?? fallback.metadata) as FileAttachment['metadata'],
        submissionStatus,
        expertApprovals,
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique file ID
 */
export function generateFileId(uid: string, timestamp: number = Date.now()): string {
    return `${uid}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract FileAttachment from a submission document.
 * Submission documents store file metadata directly on the document root.
 * @param submissionId - The submission document ID
 * @param data - The submission document data
 * @returns FileAttachment or null if no file data present
 */
function extractFileFromSubmission(submissionId: string, data: Record<string, unknown>): FileAttachment | null {
    if (Array.isArray(data.files) && data.files.length > 0) {
        const fileData = data.files[0] as Record<string, unknown>;
        const attachment = buildFileAttachment(fileData, data, submissionId);
        if (attachment) {
            return attachment;
        }
    }
    return buildFileAttachment(data, data, submissionId);
}

// ============================================================================
// File Query Operations
// ============================================================================

/**
 * Get all submission files for a specific chapter
 * @param ctx - File query context with path information
 * @returns Array of file attachments sorted by upload date (newest first)
 */
export async function getFilesForChapter(ctx: FileQueryContext): Promise<FileAttachment[]> {
    try {
        const collectionPath = resolveSubmissionsCollectionPath(ctx);
        devLog('[getFilesForChapter] Querying path:', collectionPath);
        const submissionsRef = collection(firebaseFirestore, collectionPath);
        // Try without orderBy first to avoid index issues, then sort in memory
        const snapshot = await getDocs(submissionsRef);
        devLog('[getFilesForChapter] Found', snapshot.size, 'documents');
        const files: FileAttachment[] = [];
        for (const docSnap of snapshot.docs) {
            const rawData = docSnap.data() as Record<string, unknown>;
            devLog('[getFilesForChapter] Doc', docSnap.id, 'data:', JSON.stringify(rawData, null, 2));
            const file = extractFileFromSubmission(docSnap.id, rawData);
            if (file) {
                devLog('[getFilesForChapter] Extracted file:', file.id, file.name, file.url?.substring(0, 50));
                files.push(file);
            } else {
                devLog('[getFilesForChapter] No file extracted from doc', docSnap.id);
            }
        }

        // Sort by uploadDate descending
        files.sort((a, b) => {
            const aTime = new Date(a.uploadDate ?? '').getTime();
            const bTime = new Date(b.uploadDate ?? '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
            return bTime - aTime;
        });

        return files;
    } catch (error) {
        console.error('Error getting files for chapter:', error);
        return [];
    }
}

/**
 * Get a specific submission file by ID
 * @param ctx - File query context with path information
 * @param submissionId - The submission document ID
 * @returns FileAttachment or null if not found
 */
export async function getFileBySubmissionId(
    ctx: FileQueryContext,
    submissionId: string
): Promise<FileAttachment | null> {
    try {
        const docPath = resolveSubmissionDocPath(ctx, submissionId);
        const docRef = doc(firebaseFirestore, docPath);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;
        return extractFileFromSubmission(docSnap.id, docSnap.data() as Record<string, unknown>);
    } catch (error) {
        console.error('Error getting file by submission ID:', error);
        return null;
    }
}

/**
 * Get multiple submission files by their IDs
 * @param ctx - File query context with path information  
 * @param submissionIds - Array of submission document IDs
 * @returns Array of file attachments
 */
export async function getFilesBySubmissionIds(
    ctx: FileQueryContext,
    submissionIds: string[]
): Promise<FileAttachment[]> {
    if (!submissionIds || submissionIds.length === 0) return [];

    try {
        const files: FileAttachment[] = [];

        // Fetch each submission document
        await Promise.all(
            submissionIds.map(async (submissionId) => {
                const file = await getFileBySubmissionId(ctx, submissionId);
                if (file) {
                    files.push(file);
                }
            })
        );

        // Sort by uploadDate descending
        return files.sort((a, b) => {
            const aTime = new Date(a.uploadDate ?? '').getTime();
            const bTime = new Date(b.uploadDate ?? '').getTime();
            if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
            return bTime - aTime;
        });
    } catch (error) {
        console.error('Error getting files by submission IDs:', error);
        return [];
    }
}

/**
 * Get the latest submission file for a chapter
 * @param ctx - File query context with path information
 * @returns Latest file attachment or null
 */
export async function getLatestChapterFile(ctx: FileQueryContext): Promise<FileAttachment | null> {
    const files = await getFilesForChapter(ctx);
    return files[0] ?? null;
}

// ============================================================================
// Real-time Listeners
// ============================================================================

/**
 * Listen to submission files for a specific chapter in real-time
 * @param ctx - File query context with path information
 * @param options - Callbacks for data and errors
 * @returns Unsubscribe function
 */
export function listenFilesForChapter(
    ctx: FileQueryContext,
    options: FileListenerOptions
): () => void {
    const collectionPath = resolveSubmissionsCollectionPath(ctx);
    const submissionsRef = collection(firebaseFirestore, collectionPath);

    return onSnapshot(
        submissionsRef,
        (snapshot) => {
            const files: FileAttachment[] = [];
            for (const docSnap of snapshot.docs) {
                const rawData = docSnap.data() as Record<string, unknown>;
                const file = extractFileFromSubmission(docSnap.id, rawData);
                if (file) {
                    files.push(file);
                }
            }

            // Sort by uploadDate descending
            files.sort((a, b) => {
                const aTime = new Date(a.uploadDate ?? '').getTime();
                const bTime = new Date(b.uploadDate ?? '').getTime();
                if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
                return bTime - aTime;
            });

            options.onData(files);
        },
        (error) => {
            if (options.onError) {
                options.onError(error);
            } else {
                console.error('File listener error:', error);
            }
        }
    );
}
