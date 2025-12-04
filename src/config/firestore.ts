/**
 * Firestore collection names and constants
 * Centralized configuration for all Firestore collections
 * 
 * Firestore Hierarchical Structure:
 * year/{year}
 *   ├── calendar/{events} (global events for the year)
 *   ├── agendas/{agenda} (institution-wide research agendas)
 *   ├── ESGs/{esg}
 *   ├── SDGs/{sdg}
 *   ├── users/{user}
 *   │   ├── salary/{salaryDistribution}
 *   │   └── calendar/{events}
 *   └── departments/{department}
 *       ├── departmentAgendas/{agenda}
 *       ├── calendar/{events} (department-wide events)
 *       ├── adviserSkills/{skill}
 *       ├── users/{user}
 *       │   ├── salary/{salaryDistribution}
 *       │   └── calendar/{events} 
 *       └── courses/{course}
 *           ├── agendas/{agenda} (departamental research agendas)
 *           ├── templates/"chapterTemplates"/chapters/{chapter} (document with chapter templates)
 *           ├── templates/"terminalRequirements" (parent doc with metadata)
 *           │   └── entries/{requirementId} (individual terminal requirement entries)
 *           ├── users/{user}
 *           │   └── salary/{salaryDistribution}
 *           │   └── calendar/{events} (course-wide events)
 *           └── groups/{group}
 *               ├── audits/{audit}
 *               ├── calendar/{events} (group-specific events)
 *               ├── expertRequests/{request}
 *               ├── panelComments/{comment}
 *               ├── proposals/{proposal}
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

/** Service Requests subcollection under group */
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

/** Adviser skills template subcollection under department */
export const ADVISER_SKILLS_SUBCOLLECTION = 'adviserSkills';

/** Slot requests subcollection under year */
export const SLOT_REQUESTS_SUBCOLLECTION = 'slotRequests';

/** Chapter slot reservations subcollection under year */
export const CHAPTER_SLOTS_SUBCOLLECTION = 'chapterSlots';

/** Salary subcollection under user documents */
export const SALARY_SUBCOLLECTION = 'salary';

/** Calendar subcollection - used at all hierarchy levels (year, department, course, group, user) */
export const CALENDAR_SUBCOLLECTION = 'calendar';

/** Events subcollection under calendar */
export const EVENTS_SUBCOLLECTION = 'events';

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

import StagesConfig from './stages.json';
import type { ThesisStageName } from '../types/thesis';

/**
 * Map stage names to their URL-friendly slugs (derived from JSON config)
 */
export const THESIS_STAGE_SLUGS = StagesConfig.stages.reduce(
    (acc, stage) => {
        acc[stage.name as ThesisStageName] = stage.slug;
        return acc;
    },
    {} as Record<ThesisStageName, string>
);

export type ThesisStageSlug = typeof StagesConfig.stages[number]['slug'];

// ============================================================================
// Firestore Query Limits
// ============================================================================

export const FIRESTORE_IN_QUERY_LIMIT = 10;
export const FIRESTORE_BATCH_WRITE_LIMIT = 400;
