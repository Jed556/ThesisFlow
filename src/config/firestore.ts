/**
 * Firestore collection names and constants
 * Centralized configuration for all Firestore collections
 *
 * Configuration Hierarchy:
 * configuration/departments/{department}/courses/{course}/chapters/{chapter}
 * configuration/terminal/{requirement}
 * 
 * Group Hierarchical Structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{group}
 *   ├── expertRequests/{request}
 *   ├── proposals/{proposal}
 *   ├── thesis/{thesis}
 *   │   └── stages/{stage}/chapters/{chapter}
 *   │       └── submissions/{submission}/chats/{chat}
 *   └── audits/{audit}
 * 
 * User Hierarchical Structure:
 * year/{year}/departments/{department}/courses/{course}/users/{user}
 * year/{year}/departments/{department}/users/{user}
 * year/{year}/users/{user}
 */

// ============================================================================
// Default values
// ============================================================================

export const DEFAULT_YEAR = new Date().getFullYear().toString();
export const DEFAULT_DEPARTMENT_SEGMENT = 'general';
export const DEFAULT_COURSE_SEGMENT = 'common';

// ============================================================================
// Collection/Subcollection Names
// ============================================================================

/** Root year collection */
export const YEAR_ROOT = 'year';

/** Departments subcollection */
export const DEPARTMENTS_SUBCOLLECTION = 'departments';

/** Courses subcollection */
export const COURSES_SUBCOLLECTION = 'courses';

/** Groups subcollection */
export const GROUPS_SUBCOLLECTION = 'groups';

/** Expert requests subcollection under group */
export const EXPERT_REQUESTS_SUBCOLLECTION = 'expertRequests';

/** Proposals subcollection under group */
export const PROPOSALS_SUBCOLLECTION = 'proposals';

/** Thesis subcollection under group */
export const THESIS_SUBCOLLECTION = 'thesis';

/** Stages subcollection under thesis */
export const STAGES_SUBCOLLECTION = 'stages';

/** Chapters subcollection under stage */
export const CHAPTERS_SUBCOLLECTION = 'chapters';

/** Submissions subcollection under chapter */
export const SUBMISSIONS_SUBCOLLECTION = 'submissions';

/** Chats subcollection under submission */
export const CHATS_SUBCOLLECTION = 'chats';

/** Audits subcollection under group */
export const AUDITS_SUBCOLLECTION = 'audits';

/** Panel comments subcollection under group */
export const PANEL_COMMENTS_SUBCOLLECTION = 'panelComments';

/** Terminal requirements subcollection under stage */
export const TERMINAL_SUBCOLLECTION = 'terminal';

/** Users subcollection */
export const USERS_SUBCOLLECTION = 'users';

// ============================================================================
// Configuration Collection (Global settings)
// ============================================================================

/** Root configuration collection for global settings */
export const CONFIGURATION_ROOT = 'configuration';

/** Terminal requirements key */
export const TERMINAL_REQUIREMENTS_KEY = 'terminalRequirements';

/** Chapter templates key */
export const CHAPTER_TEMPLATES_KEY = 'chapterTemplates';

// ============================================================================
// Path Parameters Interface
// ============================================================================

export interface PathParams {
    year?: string;
    department?: string;
    course?: string;
    groupId?: string;
    thesisId?: string;
    stage?: string;
    chapterId?: string;
    submissionId?: string;
    requirementId?: string;
}

// ============================================================================
// Sanitization Utilities
// ============================================================================

/**
 * Sanitize a string for use in Firestore paths
 */
export function sanitizePathSegment(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback;
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

/**
 * Get current academic year (can be customized based on academic calendar)
 */
export function getCurrentAcademicYear(): string {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const year = now.getFullYear();
    // If before August, use previous year as academic year start
    return month < 7 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
}

// ============================================================================
// Base Path Builders
// ============================================================================

/**
 * Build path to year document
 */
export function buildYearPath(year: string = DEFAULT_YEAR): string {
    return `${YEAR_ROOT}/${year}`;
}

/**
 * Build path to department document
 */
export function buildDepartmentPath(year: string, department: string): string {
    const deptKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    return `${YEAR_ROOT}/${year}/${DEPARTMENTS_SUBCOLLECTION}/${deptKey}`;
}

/**
 * Build path to course document
 */
export function buildCoursePath(year: string, department: string, course: string): string {
    const deptKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    const courseKey = sanitizePathSegment(course, DEFAULT_COURSE_SEGMENT);
    return `${YEAR_ROOT}/${year}/${DEPARTMENTS_SUBCOLLECTION}/${deptKey}/${COURSES_SUBCOLLECTION}/${courseKey}`;
}

// ============================================================================
// Group Path Builders
// ============================================================================

/**
 * Build path to groups collection under a course
 */
export function buildGroupsCollectionPath(year: string, department: string, course: string): string {
    return `${buildCoursePath(year, department, course)}/${GROUPS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific group document
 */
export function buildGroupDocPath(year: string, department: string, course: string, groupId: string): string {
    return `${buildGroupsCollectionPath(year, department, course)}/${groupId}`;
}

// ============================================================================
// Expert Requests Path Builders
// ============================================================================

/**
 * Build path to expert requests collection under a group
 */
export function buildExpertRequestsCollectionPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildGroupDocPath(year, department, course, groupId)}/${EXPERT_REQUESTS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific expert request document
 */
export function buildExpertRequestDocPath(
    year: string, department: string, course: string, groupId: string, requestId: string
): string {
    return `${buildExpertRequestsCollectionPath(year, department, course, groupId)}/${requestId}`;
}

// ============================================================================
// Proposals Path Builders
// ============================================================================

/**
 * Build path to proposals collection under a group
 */
export function buildProposalsCollectionPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildGroupDocPath(year, department, course, groupId)}/${PROPOSALS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific proposal document
 */
export function buildProposalDocPath(
    year: string, department: string, course: string, groupId: string, proposalId: string
): string {
    return `${buildProposalsCollectionPath(year, department, course, groupId)}/${proposalId}`;
}

// ============================================================================
// Thesis Path Builders
// ============================================================================

/**
 * Build path to thesis collection under a group
 */
export function buildThesisCollectionPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildGroupDocPath(year, department, course, groupId)}/${THESIS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific thesis document
 */
export function buildThesisDocPath(
    year: string, department: string, course: string, groupId: string, thesisId: string
): string {
    return `${buildThesisCollectionPath(year, department, course, groupId)}/${thesisId}`;
}

// ============================================================================
// Stage Path Builders
// ============================================================================

/**
 * Build path to stages collection under a thesis
 */
export function buildStagesCollectionPath(
    year: string, department: string, course: string, groupId: string, thesisId: string
): string {
    return `${buildThesisDocPath(year, department, course, groupId, thesisId)}/${STAGES_SUBCOLLECTION}`;
}

/**
 * Build path to a specific stage document
 */
export function buildStageDocPath(
    year: string, department: string, course: string, groupId: string, thesisId: string, stage: string
): string {
    return `${buildStagesCollectionPath(year, department, course, groupId, thesisId)}/${stage}`;
}

// ============================================================================
// Chapter Path Builders
// ============================================================================

/**
 * Build path to chapters collection under a stage
 */
export function buildChaptersCollectionPath(
    year: string, department: string, course: string, groupId: string, thesisId: string, stage: string
): string {
    return `${buildStageDocPath(year, department, course, groupId, thesisId, stage)}/${CHAPTERS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific chapter document
 */
export function buildChapterDocPath(
    year: string, department: string, course: string, groupId: string,
    thesisId: string, stage: string, chapterId: string
): string {
    return `${buildChaptersCollectionPath(year, department, course, groupId, thesisId, stage)}/${chapterId}`;
}

// ============================================================================
// Submission Path Builders
// ============================================================================

/**
 * Build path to submissions collection under a chapter
 */
export function buildSubmissionsCollectionPath(
    year: string, department: string, course: string, groupId: string,
    thesisId: string, stage: string, chapterId: string
): string {
    return `${buildChapterDocPath(year, department, course, groupId, thesisId, stage, chapterId)}/${SUBMISSIONS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific submission document
 */
export function buildSubmissionDocPath(
    year: string, department: string, course: string, groupId: string,
    thesisId: string, stage: string, chapterId: string, submissionId: string
): string {
    return `${buildSubmissionsCollectionPath(year, department, course, groupId, thesisId, stage, chapterId)}/${submissionId}`;
}

// ============================================================================
// Chat Path Builders
// ============================================================================

/**
 * Build path to chats collection under a submission
 */
export function buildChatsCollectionPath(
    year: string, department: string, course: string, groupId: string,
    thesisId: string, stage: string, chapterId: string, submissionId: string
): string {
    const submissionPath = buildSubmissionDocPath(
        year, department, course, groupId, thesisId, stage, chapterId, submissionId
    );
    return `${submissionPath}/${CHATS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific chat document
 */
export function buildChatDocPath(
    year: string, department: string, course: string, groupId: string,
    thesisId: string, stage: string, chapterId: string, submissionId: string, chatId: string
): string {
    return `${buildChatsCollectionPath(year, department, course, groupId, thesisId, stage, chapterId, submissionId)}/${chatId}`;
}

// ============================================================================
// Audit Path Builders
// ============================================================================

/**
 * Build path to audits collection under a group
 */
export function buildAuditsCollectionPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildGroupDocPath(year, department, course, groupId)}/${AUDITS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific audit document
 */
export function buildAuditDocPath(
    year: string, department: string, course: string, groupId: string, auditId: string
): string {
    return `${buildAuditsCollectionPath(year, department, course, groupId)}/${auditId}`;
}

// ============================================================================
// Panel Comments Path Builders
// ============================================================================

/**
 * Build path to panel comments collection under a group
 */
export function buildPanelCommentsCollectionPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildGroupDocPath(year, department, course, groupId)}/${PANEL_COMMENTS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific panel comment document (group-level release state)
 */
export function buildPanelCommentDocPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildPanelCommentsCollectionPath(year, department, course, groupId)}/release`;
}

/**
 * Build path to panel comment entries collection under a group
 */
export function buildPanelCommentEntriesCollectionPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildPanelCommentsCollectionPath(year, department, course, groupId)}/entries`;
}

/**
 * Build path to a specific panel comment entry document
 */
export function buildPanelCommentEntryDocPath(
    year: string, department: string, course: string, groupId: string, entryId: string
): string {
    return `${buildPanelCommentEntriesCollectionPath(year, department, course, groupId)}/${entryId}`;
}

// ============================================================================
// User Path Builders
// ============================================================================

/**
 * Build path to users collection under a course
 */
export function buildCourseUsersCollectionPath(
    year: string, department: string, course: string
): string {
    return `${buildCoursePath(year, department, course)}/${USERS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific user document under a course
 */
export function buildCourseUserDocPath(
    year: string, department: string, course: string, userId: string
): string {
    return `${buildCourseUsersCollectionPath(year, department, course)}/${userId}`;
}

/**
 * Build path to users collection under a department
 */
export function buildDepartmentUsersCollectionPath(
    year: string, department: string
): string {
    return `${buildDepartmentPath(year, department)}/${USERS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific user document under a department
 */
export function buildDepartmentUserDocPath(
    year: string, department: string, userId: string
): string {
    return `${buildDepartmentUsersCollectionPath(year, department)}/${userId}`;
}

/**
 * Build path to users collection under a year (for admin/developer roles)
 * Path: year/{year}/users
 */
export function buildYearUsersCollectionPath(year: string): string {
    return `${buildYearPath(year)}/${USERS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific user document under a year (for admin/developer roles)
 * Path: year/{year}/users/{userId}
 */
export function buildYearUserDocPath(year: string, userId: string): string {
    return `${buildYearUsersCollectionPath(year)}/${userId}`;
}

// ============================================================================
// Terminal Requirements Path Builders (under stage)
// ============================================================================

/**
 * Build path to terminal requirements collection under a stage
 * Path: year/{year}/departments/{dept}/courses/{course}/groups/{group}/thesis/{thesis}/stages/{stage}/terminal
 */
export function buildTerminalCollectionPath(
    year: string, department: string, course: string, groupId: string, thesisId: string, stage: string
): string {
    return `${buildStageDocPath(year, department, course, groupId, thesisId, stage)}/${TERMINAL_SUBCOLLECTION}`;
}

/**
 * Build path to a specific terminal requirement document
 */
export function buildTerminalDocPath(
    year: string, department: string, course: string, groupId: string,
    thesisId: string, stage: string, requirementId: string
): string {
    const terminalPath = buildTerminalCollectionPath(
        year, department, course, groupId, thesisId, stage
    );
    return `${terminalPath}/${requirementId}`;
}

// ============================================================================
// Configuration Path Builders
// ============================================================================

/**
 * Build path to terminal requirements collection (global)
 */
export function buildTerminalRequirementsPath(): string {
    return `${CONFIGURATION_ROOT}/${TERMINAL_REQUIREMENTS_KEY}`;
}

/**
 * Build path to configuration department document
 * Path: configuration/departments/{department}
 */
export function buildConfigDepartmentPath(department: string): string {
    const deptKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    return `${CONFIGURATION_ROOT}/${DEPARTMENTS_SUBCOLLECTION}/${deptKey}`;
}

/**
 * Build path to configuration course document
 * Path: configuration/departments/{department}/courses/{course}
 */
export function buildConfigCoursePath(department: string, course: string): string {
    const deptKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    const courseKey = sanitizePathSegment(course, DEFAULT_COURSE_SEGMENT);
    return `${buildConfigDepartmentPath(deptKey)}/${COURSES_SUBCOLLECTION}/${courseKey}`;
}

/**
 * Build path to chapter configs for a department/course
 * Path: configuration/departments/{department}/courses/{course}/chapters
 */
export function buildChapterConfigsPath(department: string, course: string): string {
    return `${buildConfigCoursePath(department, course)}/${CHAPTERS_SUBCOLLECTION}`;
}

/**
 * Build path to chapter templates for a department/course
 * Path: configuration/departments/{department}/courses/{course}/chapterTemplates
 */
export function buildChapterTemplatesPath(department: string, course: string): string {
    return `${buildConfigCoursePath(department, course)}/${CHAPTER_TEMPLATES_KEY}`;
}

// ============================================================================
// Path Extraction Utilities
// ============================================================================

/**
 * Extract path parameters from a document reference path
 */
export function extractPathParams(refPath: string): PathParams {
    const parts = refPath.split('/');
    const params: PathParams = {};

    for (let i = 0; i < parts.length - 1; i += 2) {
        const key = parts[i];
        const value = parts[i + 1];

        switch (key) {
            case YEAR_ROOT:
                params.year = value;
                break;
            case DEPARTMENTS_SUBCOLLECTION:
                params.department = value;
                break;
            case COURSES_SUBCOLLECTION:
                params.course = value;
                break;
            case GROUPS_SUBCOLLECTION:
                params.groupId = value;
                break;
            case THESIS_SUBCOLLECTION:
                params.thesisId = value;
                break;
            case STAGES_SUBCOLLECTION:
                params.stage = value;
                break;
            case CHAPTERS_SUBCOLLECTION:
                params.chapterId = value;
                break;
            case SUBMISSIONS_SUBCOLLECTION:
                params.submissionId = value;
                break;
            case TERMINAL_SUBCOLLECTION:
                params.requirementId = value;
                break;
        }
    }

    return params;
}

// ============================================================================
// Thesis Stage Slugs
// ============================================================================

export const THESIS_STAGE_SLUGS = {
    'Pre-Proposal': 'pre-proposal',
    'Post-Proposal': 'post-proposal',
    'Pre-Defense': 'pre-defense',
    'Post-Defense': 'post-defense',
} as const;

export type ThesisStageSlug = typeof THESIS_STAGE_SLUGS[keyof typeof THESIS_STAGE_SLUGS];

// ============================================================================
// Firestore Query Limits
// ============================================================================

export const FIRESTORE_IN_QUERY_LIMIT = 10;
export const FIRESTORE_BATCH_WRITE_LIMIT = 400;
