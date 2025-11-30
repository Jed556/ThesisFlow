import type { FileAttachment } from '../types/file';
import type { ThesisStageName } from '../types/thesis';
import type {
    TerminalRequirement,
    TerminalRequirementStatus,
} from '../types/terminalRequirement';
import { getFilesByTerminalRequirement } from './firebase/firestore/file';

export const TERMINAL_REQUIREMENTS: TerminalRequirement[] = [
    {
        id: 'preproposal-clearance-form',
        stage: 'Pre-Proposal',
        title: 'Clearance Form',
        description: 'Signed clearance form from the research coordinator confirming your slot for the pre-proposal defense.',
        instructions: 'Submit a single PDF that contains the form and all signatures from panel members.',
    },
    {
        id: 'preproposal-endorsement',
        stage: 'Pre-Proposal',
        title: 'Endorsement Letter',
        description: 'Department chair endorsement letter or email confirming your defense schedule.',
        instructions: 'Merge multiple images into one PDF to keep the review flow seamless.',
    },
    {
        id: 'preproposal-timeline',
        stage: 'Pre-Proposal',
        title: 'Updated Research Timeline',
        description: 'Latest Gantt chart or project timeline reflecting adjustments discussed during the proposal hearing.',
        instructions: 'We recommend exporting your chart as PDF for consistent formatting.',
    },
    {
        id: 'postproposal-revised-manuscript',
        stage: 'Post-Proposal',
        title: 'Revised Manuscript (Chapters 1-3)',
        description: 'Annotated manuscript that integrates the feedback from the proposal panel.',
        instructions: 'Combine chapters 1-3 into a single PDF with change tracking enabled.',
    },
    {
        id: 'postproposal-feedback-log',
        stage: 'Post-Proposal',
        title: 'Feedback Log',
        description: 'Summary of actionable items from advisers and editors plus their current status.',
        instructions: 'Use the provided template from the Research Office if available.',
    },
    {
        id: 'postproposal-data-plan',
        stage: 'Post-Proposal',
        title: 'Data Collection Plan',
        description: 'Detailed plan outlining instruments, sampling, and timeline for data gathering.',
        instructions: 'Convert spreadsheets to PDF prior to uploading.',
        optional: true,
    },
    {
        id: 'predefense-complete-manuscript',
        stage: 'Pre-Defense',
        title: 'Complete Manuscript Draft',
        description: 'Latest draft containing chapters 1-5 ready for pre-defense review.',
        instructions: 'Single PDF only. Include title page and approval sheets.',
    },
    {
        id: 'predefense-similarity-report',
        stage: 'Pre-Defense',
        title: 'Similarity Report',
        description: 'Most recent plagiarism or similarity report signed by your adviser.',
        instructions: 'Export the highlighted PDF from Turnitin or the prescribed checker.',
    },
    {
        id: 'predefense-endorsement',
        stage: 'Pre-Defense',
        title: 'Panel Endorsement',
        description: 'Signed panel endorsement or email thread approving you for defense scheduling.',
        instructions: 'Consolidate multiple screenshots into one PDF before uploading.',
    },
    {
        id: 'postdefense-final-manuscript',
        stage: 'Post-Defense',
        title: 'Final Manuscript',
        description: 'Camera-ready version of your thesis incorporating all post-defense revisions.',
        instructions: 'Ensure pagination matches the binding-ready template.',
    },
    {
        id: 'postdefense-binding-request',
        stage: 'Post-Defense',
        title: 'Binding Request Form',
        description: 'Signed request form for printing and binding final copies.',
        instructions: 'Attach proof of payment if required by your department.',
        optional: true,
    },
    {
        id: 'postdefense-final-clearance',
        stage: 'Post-Defense',
        title: 'Final Clearance Slip',
        description: 'Office of Research clearance indicating that all deliverables were accepted.',
        instructions: 'Upload as a single PDF or image.',
    },
];

/**
 * Returns all requirement definitions for a given stage.
 */
export function getTerminalRequirementsByStage(stage: ThesisStageName): TerminalRequirement[] {
    return TERMINAL_REQUIREMENTS.filter((requirement) => requirement.stage === stage);
}

/**
 * Derives the current status of a terminal requirement based on uploaded files.
 */
export function getTerminalRequirementStatus(files?: FileAttachment[]): TerminalRequirementStatus {
    return files && files.length > 0 ? 'submitted' : 'pending';
}

/**
 * Fetches all uploaded files linked to a requirement.
 */
export async function fetchTerminalRequirementFiles(
    thesisId: string,
    requirementId: string,
): Promise<FileAttachment[]> {
    return getFilesByTerminalRequirement(thesisId, requirementId);
}
