/**
 * Firestore Agenda Types
 * 
 * Represents hierarchical research agendas stored in Firestore.
 * Institution-wide agendas are stored at: year/{year}/agendas/{agendaId}
 * Department-specific agendas are stored at: year/{year}/departments/{dept}/departmentAgendas/{agendaId}
 */

/**
 * Base agenda document structure stored in Firestore
 * Each document represents a main theme with its sub-themes
 */
export interface AgendaDocument {
    /** Unique identifier (A, B, C, etc.) */
    id: string;
    /** Main theme title */
    title: string;
    /** Array of sub-theme strings */
    subThemes: string[];
    /** Timestamp when the agenda was created */
    createdAt?: Date;
    /** Timestamp when the agenda was last updated */
    updatedAt?: Date;
}

/**
 * Agenda document with Firestore document ID
 */
export interface AgendaDocumentWithId extends AgendaDocument {
    /** Firestore document ID */
    docId: string;
}

/**
 * Type for agenda scope - institution-wide or department-specific
 */
export type AgendaScope = 'institutional' | 'department';

/**
 * Parameters for agenda operations
 */
export interface AgendaParams {
    /** Academic year */
    year?: string;
    /** Department name (required for department-specific agendas) */
    department?: string;
    /** Scope of the agenda */
    scope: AgendaScope;
}
