/**
 * CSV utilities for ThesisFlow
 * Centralized export for all CSV import/export functionality
 */

// Core parsing utilities
export {
    parseCsvText,
    normalizeHeader,
    mapHeaderIndexes,
    splitArrayField,
    parseBoolean,
    generateCsvText,
} from './parser';

// User import/export
export {
    importUsersFromCsv,
    exportUsersToCsv,
} from './user';
export type { ImportedUser } from './user';

// Schedule import/export
export {
    importScheduleFromCsv,
    exportScheduleToCsv,
} from './schedule';

// Calendar import/export
export {
    importCalendarsFromCsv,
    exportCalendarsToCsv,
} from './calendar';
export type { ImportedCalendarRecord } from './calendar';

// File import/export
export {
    importFilesFromCsv,
    exportFilesToCsv,
} from './file';

// Thesis import/export
export {
    importThesesFromCsv,
    exportThesesToCsv,
} from './thesis';

// Group import/export
export {
    importGroupsFromCsv,
    exportGroupsToCsv,
} from './group';

// TODO: Form import/export (form.ts not yet created)
// export {
//     importFormsFromCsv,
//     exportFormsToCsv,
// } from './form';

// Topic proposal import/export
export {
    importTopicProposalsFromCsv,
    exportTopicProposalsToCsv,
} from './topicProposal';
