import {
    DEFAULT_YEAR, YEAR_ROOT, DEFAULT_DEPARTMENT_SEGMENT, DEFAULT_COURSE_SEGMENT, DEPARTMENTS_SUBCOLLECTION,
    COURSES_SUBCOLLECTION, COURSE_TEMPLATES_SUBCOLLECTION, GROUPS_SUBCOLLECTION, EXPERT_REQUESTS_SUBCOLLECTION,
    PROPOSALS_SUBCOLLECTION, THESIS_SUBCOLLECTION, STAGES_SUBCOLLECTION, CHAPTERS_SUBCOLLECTION,
    SUBMISSIONS_SUBCOLLECTION, CHATS_SUBCOLLECTION, AUDITS_SUBCOLLECTION, PANEL_COMMENTS_SUBCOLLECTION,
    USERS_SUBCOLLECTION, TERMINAL_SUBCOLLECTION, CONFIGURATION_ROOT, TERMINAL_REQUIREMENTS_KEY,
    CHAPTER_TEMPLATES_KEY, JOIN_SUBCOLLECTION, INVITES_DOC, REQUESTS_DOC, SLOT_REQUESTS_SUBCOLLECTION,
    CHAPTER_SLOTS_SUBCOLLECTION, SALARY_SUBCOLLECTION,
    GROUP_CONFIGURATION_SUBCOLLECTION, GROUP_CONFIGURATION_CHAPTER_DOC,
    TERMINAL_REQUIREMENT_ENTRIES_SUBCOLLECTION, AGENDAS_SUBCOLLECTION, DEPARTMENT_AGENDAS_SUBCOLLECTION,
} from '../../../config/firestore';


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
 * @param value - The value to sanitize
 * @param fallback - The fallback value if the input is empty or invalid
 * @returns Sanitized string suitable for use in Firestore paths
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
// Agenda Path Builders
// ============================================================================

/**
 * Build path to institution-wide agendas collection
 * Path: year/{year}/agendas
 */
export function buildAgendasCollectionPath(year: string = DEFAULT_YEAR): string {
    return `${YEAR_ROOT}/${year}/${AGENDAS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific institution-wide agenda document
 * Path: year/{year}/agendas/{agendaId}
 */
export function buildAgendaPath(year: string, agendaId: string): string {
    return `${YEAR_ROOT}/${year}/${AGENDAS_SUBCOLLECTION}/${agendaId}`;
}

/**
 * Build path to department-specific agendas collection
 * Path: year/{year}/departments/{department}/departmentAgendas
 */
export function buildDepartmentAgendasCollectionPath(year: string, department: string): string {
    const deptKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    return `${YEAR_ROOT}/${year}/${DEPARTMENTS_SUBCOLLECTION}/${deptKey}/${DEPARTMENT_AGENDAS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific department agenda document
 * Path: year/{year}/departments/{department}/departmentAgendas/{agendaId}
 */
export function buildDepartmentAgendaPath(year: string, department: string, agendaId: string): string {
    const deptKey = sanitizePathSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    return `${YEAR_ROOT}/${year}/${DEPARTMENTS_SUBCOLLECTION}/${deptKey}/${DEPARTMENT_AGENDAS_SUBCOLLECTION}/${agendaId}`;
}

// ============================================================================
// Course Template Path Builders
// ============================================================================

/**
 * Build path to the templates collection under a course
 * Path: year/{year}/departments/{department}/courses/{course}/templates
 */
export function buildCourseTemplatesCollectionPath(
    year: string,
    department: string,
    course: string,
): string {
    return `${buildCoursePath(year, department, course)}/${COURSE_TEMPLATES_SUBCOLLECTION}`;
}

/**
 * Build path to a specific template document within a course
 */
export function buildCourseTemplateDocPath(
    year: string,
    department: string,
    course: string,
    templateKey: string,
): string {
    return `${buildCourseTemplatesCollectionPath(year, department, course)}/${templateKey}`;
}

/**
 * Build path to the course-level chapter templates document
 */
export function buildCourseChapterTemplateDocPath(
    year: string,
    department: string,
    course: string,
): string {
    return buildCourseTemplateDocPath(year, department, course, CHAPTER_TEMPLATES_KEY);
}

/**
 * Build path to the course-level terminal requirements template document
 */
export function buildCourseTerminalTemplateDocPath(
    year: string,
    department: string,
    course: string,
): string {
    return buildCourseTemplateDocPath(year, department, course, TERMINAL_REQUIREMENTS_KEY);
}

/**
 * Build path to the terminal requirement entries collection (individual requirement documents)
 * Structure: year/{year}/departments/{dept}/courses/{course}/templates/terminalRequirements/entries
 */
export function buildTerminalRequirementEntriesCollectionPath(
    year: string,
    department: string,
    course: string,
): string {
    return `${buildCourseTerminalTemplateDocPath(year, department, course)}/${TERMINAL_REQUIREMENT_ENTRIES_SUBCOLLECTION}`;
}

/**
 * Build path to a specific terminal requirement entry document
 * Structure: year/{year}/departments/{dept}/courses/{course}/templates/terminalRequirements/entries/{requirementId}
 */
export function buildTerminalRequirementEntryDocPath(
    year: string,
    department: string,
    course: string,
    requirementId: string,
): string {
    return `${buildTerminalRequirementEntriesCollectionPath(year, department, course)}/${requirementId}`;
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

/**
 * Build path to configuration collection under a group
 */
export function buildGroupConfigurationCollectionPath(
    year: string,
    department: string,
    course: string,
    groupId: string
): string {
    return `${buildGroupDocPath(year, department, course, groupId)}/${GROUP_CONFIGURATION_SUBCOLLECTION}`;
}

/**
 * Build path to a configuration document under a group (default: chapters)
 */
export function buildGroupConfigurationDocPath(
    year: string,
    department: string,
    course: string,
    groupId: string,
    docId: string = GROUP_CONFIGURATION_CHAPTER_DOC
): string {
    return `${buildGroupConfigurationCollectionPath(year, department, course, groupId)}/${docId}`;
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
// Join (Invites/Requests) Path Builders
// ============================================================================

/**
 * Build path to join subcollection under a group
 */
export function buildJoinCollectionPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildGroupDocPath(year, department, course, groupId)}/${JOIN_SUBCOLLECTION}`;
}

/**
 * Build path to invites document under join subcollection
 */
export function buildInvitesDocPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildJoinCollectionPath(year, department, course, groupId)}/${INVITES_DOC}`;
}

/**
 * Build path to requests document under join subcollection
 */
export function buildRequestsDocPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildJoinCollectionPath(year, department, course, groupId)}/${REQUESTS_DOC}`;
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
 * Structure: .../groups/{groupId}/panelComments/meta
 */
export function buildPanelCommentDocPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildPanelCommentsCollectionPath(year, department, course, groupId)}/meta`;
}

/**
 * Build path to panel comment entries collection under a group
 * Structure: .../groups/{groupId}/panelComments/meta/entries
 */
export function buildPanelCommentEntriesCollectionPath(
    year: string, department: string, course: string, groupId: string
): string {
    return `${buildPanelCommentDocPath(year, department, course, groupId)}/entries`;
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
// Slot Requests Path Builders
// ============================================================================

/**
 * Build path to slot requests collection under a year
 */
export function buildSlotRequestsCollectionPath(year: string = DEFAULT_YEAR): string {
    return `${buildYearPath(year)}/${SLOT_REQUESTS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific slot request document
 */
export function buildSlotRequestDocPath(year: string, requestId: string): string {
    return `${buildSlotRequestsCollectionPath(year)}/${requestId}`;
}

// ============================================================================
// Chapter Slot Path Builders
// ============================================================================

/**
 * Build path to chapter slot reservations collection under a year
 */
export function buildChapterSlotsCollectionPath(year: string = DEFAULT_YEAR): string {
    return `${buildYearPath(year)}/${CHAPTER_SLOTS_SUBCOLLECTION}`;
}

/**
 * Build path to a specific chapter slot document
 */
export function buildChapterSlotDocPath(year: string, slotId: string): string {
    return `${buildChapterSlotsCollectionPath(year)}/${slotId}`;
}

// ============================================================================
// Salary Distribution Path Builders
// ============================================================================

/**
 * Build path to salary collection under a year-level user
 * Path: year/{year}/users/{userId}/salary
 */
export function buildYearUserSalaryCollectionPath(year: string, userId: string): string {
    return `${buildYearUserDocPath(year, userId)}/${SALARY_SUBCOLLECTION}`;
}

/**
 * Build path to a specific salary document under a year-level user
 * Path: year/{year}/users/{userId}/salary/{salaryId}
 */
export function buildYearUserSalaryDocPath(year: string, userId: string, salaryId: string): string {
    return `${buildYearUserSalaryCollectionPath(year, userId)}/${salaryId}`;
}

/**
 * Build path to salary collection under a department-level user
 * Path: year/{year}/departments/{department}/users/{userId}/salary
 */
export function buildDepartmentUserSalaryCollectionPath(
    year: string, department: string, userId: string
): string {
    return `${buildDepartmentUserDocPath(year, department, userId)}/${SALARY_SUBCOLLECTION}`;
}

/**
 * Build path to a specific salary document under a department-level user
 * Path: year/{year}/departments/{department}/users/{userId}/salary/{salaryId}
 */
export function buildDepartmentUserSalaryDocPath(
    year: string, department: string, userId: string, salaryId: string
): string {
    return `${buildDepartmentUserSalaryCollectionPath(year, department, userId)}/${salaryId}`;
}

/**
 * Build path to salary collection under a course-level user
 * Path: year/{year}/departments/{department}/courses/{course}/users/{userId}/salary
 */
export function buildCourseUserSalaryCollectionPath(
    year: string, department: string, course: string, userId: string
): string {
    return `${buildCourseUserDocPath(year, department, course, userId)}/${SALARY_SUBCOLLECTION}`;
}

/**
 * Build path to a specific salary document under a course-level user
 * Path: year/{year}/departments/{department}/courses/{course}/users/{userId}/salary/{salaryId}
 */
export function buildCourseUserSalaryDocPath(
    year: string, department: string, course: string, userId: string, salaryId: string
): string {
    return `${buildCourseUserSalaryCollectionPath(year, department, course, userId)}/${salaryId}`;
}
