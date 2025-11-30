/**
 * Firestore collection names and constants
 * Centralized configuration for all Firestore collections
 *
 * Configuration Hierarchy:
 * configuration/
 *   ├── departments/{department}/courses/{course}/chapters/{chapter} {document with chapter details}
 *   └── terminal/{requirement} {document with requirement details}
 * 
 * Group Hierarchical Structure:
 * year/{year}/departments/{department}/courses/{course}/groups/{group}
 *   ├── expertRequests/{request}
 *   ├── proposals/{proposal}
 *   ├── panelComments/{comment}
 *   ├── join/
 *   │   ├── invites (document with userIds array)
 *   │   └── requests (document with userIds array)
 *   ├── thesis/{thesis}
 *   │   └── stages/{stage}/chapters/{chapter}
 *   │       └── submissions/{attachment}/chats/{chat}
 *   │           └── attachments/{attachment}
 *   └── audits/{audit}
 * 
 * User Hierarchical Structure:
 * year/{year}
 *   ├── users/{user}
 *   └── departments/{department}
 *       ├── users/{user}
 *       └── /courses/{course}/users/{user}
 * 
 * * Firebase Storage Hierarchical Structure:
 * * {year}/{department}/{course}/{group}
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
