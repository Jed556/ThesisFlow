import type { FileAttachment } from './file';

/**
 * Roles that can receive or author forms.
 */
export type FormAudience = 'student' | 'adviser' | 'editor';

/**
 * Supported field control types inside a dynamic form template.
 */
export type FormFieldType =
    | 'shortText'
    | 'longText'
    | 'select'
    | 'multiSelect'
    | 'date'
    | 'file'
    | 'checkbox'
    | 'signature';

/**
 * Selectable option definition for choice-based fields.
 */
export interface FormFieldOption {
    /** Stable identifier for the option. */
    id: string;
    /** Human readable option label presented to users. */
    label: string;
    /** Raw value submitted when the option is chosen. */
    value: string;
    /** Optional helper text rendered alongside the option. */
    description?: string;
}

/**
 * Schema definition for a single form field rendered inside a template.
 */
export interface FormField {
    /** Primary identifier for linking responses to the field. */
    id: string;
    /** UI control type used when rendering the field. */
    fieldType: FormFieldType;
    /** Human readable field label. */
    label: string;
    /** Whether the field must be completed before submission. */
    required?: boolean;
    /** Optional placeholder text rendered inside the control. */
    placeholder?: string;
    /** Additional contextual helper text displayed below the control. */
    helperText?: string;
    /** Available choices for select or multi-select controls. */
    options?: FormFieldOption[];
    /** Pre-populated value applied when rendering drafts. */
    defaultValue?: FormFieldValue;
    /** Allow multiple selections for choice based controls. */
    allowMultiple?: boolean;
    /** Maximum text length for string based inputs. */
    maxLength?: number;
    /** Suggested number of rows for textarea based inputs. */
    rows?: number;
}

/**
 * Form workflow step defining the sequence of approvals/reviews
 */
export interface FormWorkflowStep {
    /** Order in the workflow sequence */
    order: number;
    /** Role that needs to complete this step */
    role: FormAudience | 'admin';
    /** Label for the step */
    label: string;
    /** Whether this step requires a signature */
    requiresSignature?: boolean;
    /** Whether this step is required or optional */
    required?: boolean;
}

/**
 * Template describing a reusable form that can be assigned to participants.
 */
export interface FormTemplate {
    /** Stable identifier for the template. */
    id: string;
    /** Visible title shown to recipients. */
    title: string;
    /** Optional description that explains the form purpose. */
    description?: string;
    /** Semantic version string used to track template revisions. */
    version: string;
    /** Target audience for the template. */
    audience: FormAudience;
    /** Fields rendered in the form. */
    fields: FormField[];
    /** Publication lifecycle status. */
    status: 'draft' | 'active' | 'archived';
    /** ISO timestamp of when the template was first created. */
    createdAt: string;
    /** ISO timestamp of the most recent update. */
    updatedAt: string;
    /** Email of the user who authored the template. */
    createdBy: string;
    /** Optional quick tags for categorisation and filtering. */
    tags?: string[];
    /** Additional notes displayed to reviewers. */
    reviewerNotes?: string;
    /** Suggested due date offset in days once assigned. */
    dueInDays?: number;
    /** Default attachments bundled with the template. */
    attachments?: FileAttachment[];
    /** Workflow steps defining approval sequence */
    workflow?: FormWorkflowStep[];
    /** Group IDs that can access this form */
    availableToGroups?: string[];
}

/**
 * A concrete assignment of a template to one or more recipients.
 */
export interface FormAssignment {
    /** Unique identifier for the assignment instance. */
    id: string;
    /** Reference to the template used for this assignment. */
    templateId: string;
    /** Title displayed in inbox style listings. */
    title: string;
    /** The intended audience that must complete the assignment. */
    audience: FormAudience;
    /** Current completion status of the assignment. */
    status: 'pending' | 'inProgress' | 'submitted' | 'signed' | 'returned';
    /** Optional due date presented to recipients. */
    dueDate?: string;
    /** Email addresses that need to complete or sign the form. */
    assignedTo: string[];
    /** Timestamp of the most recent activity. */
    lastUpdated: string;
    /** Whether a formal signature is required. */
    requiresSignature?: boolean;
    /** Optional submission identifier when work has been sent in. */
    submissionId?: string;
    /** Additional notes or instructions from reviewers. */
    notes?: string;
}

/**
 * Value container for storing responses to dynamic fields.
 */
export type FormFieldValue = string | string[] | boolean | FileAttachment[] | File[] | null;

/**
 * Persisted response for a form assignment.
 */
export interface FormResponse {
    /** Assignment identifier the response belongs to. */
    assignmentId: string;
    /** Email address for the responder. */
    responder: string;
    /** ISO timestamp representing when the response was last saved. */
    submittedAt: string;
    /** Raw values keyed by field identifier. */
    values: Record<string, FormFieldValue>;
    /** Response lifecycle status. */
    status: 'draft' | 'submitted' | 'approved';
    /** Optional reviewer feedback attached to the response. */
    reviewerComments?: string;
}
