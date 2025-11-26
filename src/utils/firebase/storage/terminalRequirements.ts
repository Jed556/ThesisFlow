import { uploadFileToStorage, deleteFileFromStorage, extractStoragePath, sanitizeFilename, generateUniqueFileId } from './common';
import { getError } from '../../../../utils/errorUtils';

const TEMPLATE_ROOT = 'terminalRequirements/templates';
const DEFAULT_DEPARTMENT_SEGMENT = 'general';
const DEFAULT_COURSE_SEGMENT = 'common';

function sanitizeSegment(value: string | null | undefined, fallback: string): string {
    if (!value) {
        return fallback;
    }
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function buildTemplatePath(
    department: string,
    course: string,
    requirementId: string,
    fileId: string,
    filename: string,
): string {
    const departmentKey = sanitizeSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    const courseKey = sanitizeSegment(course, DEFAULT_COURSE_SEGMENT);
    const safeFilename = sanitizeFilename(filename);
    return `${TEMPLATE_ROOT}/${departmentKey}/${courseKey}/${requirementId}/${fileId}_${safeFilename}`;
}

export interface UploadTerminalRequirementTemplateOptions {
    file: File;
    department: string;
    course: string;
    requirementId: string;
    uploadedBy: string;
}

export interface TerminalRequirementTemplateUploadResult {
    fileId: string;
    fileName: string;
    fileUrl: string;
    storagePath: string;
}

export async function uploadTerminalRequirementTemplate(
    options: UploadTerminalRequirementTemplateOptions,
): Promise<TerminalRequirementTemplateUploadResult> {
    const { file, department, course, requirementId, uploadedBy } = options;

    if (!department || !course) {
        throw new Error('Department and course are required to store templates.');
    }

    const fileId = generateUniqueFileId(uploadedBy, `terminalreq_${requirementId}`);
    const storagePath = buildTemplatePath(department, course, requirementId, fileId, file.name);

    try {
        const fileUrl = await uploadFileToStorage(file, storagePath, {
            department,
            course,
            requirementId,
            uploadedBy,
        });

        return {
            fileId,
            fileName: file.name,
            fileUrl,
            storagePath,
        };
    } catch (error) {
        const { message } = getError(error, 'Failed to upload requirement template');
        throw new Error(message);
    }
}

export async function deleteTerminalRequirementTemplate(fileReference: string): Promise<void> {
    try {
        const storagePath = extractStoragePath(fileReference) ?? fileReference;
        await deleteFileFromStorage(storagePath);
    } catch (error) {
        const { message } = getError(error, 'Failed to delete requirement template');
        throw new Error(message);
    }
}
