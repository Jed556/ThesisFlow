/**
 * Firestore collection names and constants
 * Centralized configuration for all Firestore collections
 * 
 * Firestore Hierarchical Structure:
 * year/{year}
 *   ├── agendas/{agenda} (institution-wide research agendas)
 *   ├── ESGs/{esg}
 *   ├── SDGs/{sdg}
 *   ├── users/{user}
 *   │   └── salary/{salaryDistribution}
 *   └── departments/{department}
 *       ├── departmentAgendas/{agenda}
 *       ├── adviserSkills/{skill}
 *       ├── users/{user}
 *       │   └── salary/{salaryDistribution}
 *       └── courses/{course}
 *           ├── agendas/{agenda} (departamental research agendas)
 *           ├── templates/"chapterTemplates"/chapters/{chapter} (document with chapter templates)
 *           ├── templates/"terminalRequirements" (parent doc with metadata)
 *           │   └── entries/{requirementId} (individual terminal requirement entries)
 *           ├── users/{user}
 *           │   └── salary/{salaryDistribution}
 *           └── groups/{group}
 *               ├── audits/{audit}
 *               ├── expertRequests/{request}
 *               ├── proposals/{proposal}
 *               ├── panelComments/{comment}
 *               ├── join/
 *               │   ├── invites (document with userIds array)
 *               │   └── requests (document with userIds array)
 *               └── thesis/{thesis}
 *                   └── stages/{stage}/chapters/{chapter}
 *                       └── submissions/{attachment}/chats/{chat}
 *                           └── attachments/{attachment}
 * 
 * Firebase Storage Hierarchical Structure:
 * {year}/{department}/{course}/{group}
 *   ├── expertRequests/{requestAttachments}
 *   ├── proposals/{proposalAttachments}
 *   ├── panelComments/{commentAttachments}
 *   └── thesis/{thesis}
 *       └── {stage}/{chapter}
 *           └── submissions/{submissionAttachments}
 *               └── chats/{chatAttachments}
 */

import { getAcademicYear } from '../utils/dateUtils';

// ============================================================================
// Default values
// ============================================================================

export const DEFAULT_YEAR = getAcademicYear();
export const DEFAULT_DEPARTMENT_SEGMENT = 'general';
export const DEFAULT_COURSE_SEGMENT = 'common';

// ============================================================================
// Collection/Subcollection Names
// ============================================================================

/** Root year collection */
export const YEAR_ROOT = 'year';

/** Institution-wide agendas subcollection under year */
export const AGENDAS_SUBCOLLECTION = 'agendas';

/** Departments subcollection */
export const DEPARTMENTS_SUBCOLLECTION = 'departments';

/** Department-specific agendas subcollection under department */
export const DEPARTMENT_AGENDAS_SUBCOLLECTION = 'departmentAgendas';

/** Courses subcollection */
export const COURSES_SUBCOLLECTION = 'courses';

/** Templates subcollection under a course */
export const COURSE_TEMPLATES_SUBCOLLECTION = 'templates';

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

/** Join subcollection under group (contains invites and requests documents) */
export const JOIN_SUBCOLLECTION = 'join';

/** Invites document ID under join subcollection */
export const INVITES_DOC = 'invites';

/** Requests document ID under join subcollection */
export const REQUESTS_DOC = 'requests';

/** Terminal requirements subcollection under stage */
export const TERMINAL_SUBCOLLECTION = 'terminal';

/** Users subcollection */
export const USERS_SUBCOLLECTION = 'users';

/** Slot requests subcollection under year */
export const SLOT_REQUESTS_SUBCOLLECTION = 'slotRequests';

/** Chapter slot reservations subcollection under year */
export const CHAPTER_SLOTS_SUBCOLLECTION = 'chapterSlots';

/** Salary subcollection under user documents */
export const SALARY_SUBCOLLECTION = 'salary';

// ============================================================================
// Configuration Collection (Global settings)
// ============================================================================

/** Root configuration path (collection/doc) for global settings */
export const CONFIGURATION_ROOT = 'configuration/settings';

/** Terminal requirements key */
export const TERMINAL_REQUIREMENTS_KEY = 'terminalRequirements';

/** Subcollection for individual terminal requirement entries under the template */
export const TERMINAL_REQUIREMENT_ENTRIES_SUBCOLLECTION = 'entries';

/** Chapter templates key */
export const CHAPTER_TEMPLATES_KEY = 'chapterTemplates';

/** Group-level configuration subcollection under each group */
export const GROUP_CONFIGURATION_SUBCOLLECTION = 'configuration';

/** Group-level chapter template document ID */
export const GROUP_CONFIGURATION_CHAPTER_DOC = 'chapters';

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
