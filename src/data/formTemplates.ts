import { mockFileRegistry } from './mockData';
import type { FormAssignment, FormTemplate } from '../types/forms';

/**
 * Mock form templates used across the review workspace.
 */
export const formTemplates: FormTemplate[] = [
    {
        id: 'student-progress-update',
        title: 'Weekly Thesis Progress Update',
        description: 'Capture weekly milestones, blockers, and supporting documents from the thesis team.',
        version: '1.2.0',
        audience: 'student',
        fields: [
            {
                id: 'milestone-title',
                fieldType: 'shortText',
                label: 'Headline Milestone',
                placeholder: 'Summarize the key milestone achieved this week',
                required: true,
                maxLength: 120,
            },
            {
                id: 'milestone-status',
                fieldType: 'multiSelect',
                label: 'Current Status',
                helperText: 'Select all statuses that apply to this update.',
                options: [
                    { id: 'status-in-progress', label: 'In Progress', value: 'in-progress' },
                    { id: 'status-complete', label: 'Completed', value: 'complete' },
                    { id: 'status-blocked', label: 'Blocked', value: 'blocked' },
                    { id: 'status-awaiting', label: 'Awaiting Feedback', value: 'awaiting-feedback' }
                ],
                allowMultiple: true,
                required: true,
            },
            {
                id: 'detailed-update',
                fieldType: 'longText',
                label: 'Detailed Update',
                helperText: 'Share accomplishments, learnings, and outstanding questions.',
                rows: 6,
                required: true,
            },
            {
                id: 'supporting-files',
                fieldType: 'file',
                label: 'Supporting Documents',
                helperText: 'Upload drafts or research artifacts (PDF, DOCX, PPT).',
            }
        ],
        status: 'active',
        createdAt: '2025-01-05T09:30:00Z',
        updatedAt: '2025-10-12T14:45:00Z',
        createdBy: 'mike.johnson@university.edu',
        tags: ['progress', 'student'],
        dueInDays: 7,
        reviewerNotes: 'Automatically routes to the adviser after submission.',
        attachments: [mockFileRegistry['g7h8i9j0']].filter(Boolean),
    },
    {
        id: 'student-ethics-clearance',
        title: 'Ethics Compliance Declaration',
        description: 'Standard declaration to confirm adherence to research ethics and data privacy policies.',
        version: '2.0.0',
        audience: 'student',
        fields: [
            {
                id: 'project-title',
                fieldType: 'shortText',
                label: 'Project Title',
                required: true,
                placeholder: 'Enter the official thesis title',
            },
            {
                id: 'ethics-training-date',
                fieldType: 'date',
                label: 'Most Recent Ethics Training Date',
                required: true,
            },
            {
                id: 'confidential-data',
                fieldType: 'checkbox',
                label: 'This research handles confidential or personally identifiable information.',
                helperText: 'Selecting this will prompt the adviser to review additional safeguards.',
            },
            {
                id: 'signature',
                fieldType: 'signature',
                label: 'Digital Signature',
                required: true,
                helperText: 'Sign with your registered name.',
            }
        ],
        status: 'active',
        createdAt: '2024-11-18T12:00:00Z',
        updatedAt: '2025-02-02T16:30:00Z',
        createdBy: 'jane.smith@university.edu',
        tags: ['compliance', 'ethics'],
        reviewerNotes: 'Required before any human-subject data collection can begin.',
    },
    {
        id: 'reviewer-evaluation',
        title: 'Chapter Evaluation Worksheet',
        description: 'Structured rubric for advisers and editors to evaluate submitted chapters.',
        version: '3.1.0',
        audience: 'adviser',
        fields: [
            {
                id: 'chapter-selection',
                fieldType: 'select',
                label: 'Chapter Reviewed',
                required: true,
                options: [
                    { id: 'chapter-1', label: 'Chapter 1: Introduction', value: 'chapter-1' },
                    { id: 'chapter-2', label: 'Chapter 2: Literature Review', value: 'chapter-2' },
                    { id: 'chapter-3', label: 'Chapter 3: Methodology', value: 'chapter-3' },
                    { id: 'chapter-4', label: 'Chapter 4: Results', value: 'chapter-4' },
                    { id: 'chapter-5', label: 'Chapter 5: Conclusion', value: 'chapter-5' }
                ],
            },
            {
                id: 'quality-rating',
                fieldType: 'select',
                label: 'Overall Quality Rating',
                required: true,
                options: [
                    { id: 'rating-excellent', label: 'Excellent', value: 'excellent' },
                    { id: 'rating-good', label: 'Good', value: 'good' },
                    { id: 'rating-fair', label: 'Fair', value: 'fair' },
                    { id: 'rating-poor', label: 'Needs Major Revision', value: 'poor' }
                ],
            },
            {
                id: 'qualitative-feedback',
                fieldType: 'longText',
                label: 'Narrative Feedback',
                helperText: 'Share actionable feedback, referencing specific sections where possible.',
                rows: 5,
                required: true,
            },
            {
                id: 'approval-checkbox',
                fieldType: 'checkbox',
                label: 'I recommend moving this chapter to the next stage.',
            },
            {
                id: 'reviewer-signature',
                fieldType: 'signature',
                label: 'Reviewer Signature',
                required: true,
            }
        ],
        status: 'active',
        createdAt: '2025-03-15T08:20:00Z',
        updatedAt: '2025-09-01T11:12:00Z',
        createdBy: 'david.kim@university.edu',
        tags: ['evaluation', 'rubric'],
        reviewerNotes: 'Automatically attaches the most recent student submission to the evaluation packet.',
    },
    {
        id: 'editor-final-approval',
        title: 'Final Manuscript Approval',
        description: 'Sign-off form for editors to confirm manuscript readiness before defense submission.',
        version: '1.5.0',
        audience: 'editor',
        fields: [
            {
                id: 'manuscript-version',
                fieldType: 'shortText',
                label: 'Manuscript Version',
                placeholder: 'e.g., v1.4 final',
                required: true,
            },
            {
                id: 'completeness-check',
                fieldType: 'checkbox',
                label: 'All required sections and appendices are included.',
                required: true,
            },
            {
                id: 'compliance-check',
                fieldType: 'checkbox',
                label: 'Formatting and citation styles comply with institutional guidelines.',
                required: true,
            },
            {
                id: 'editor-comments',
                fieldType: 'longText',
                label: 'Final Notes to the Panel',
                rows: 4,
            },
            {
                id: 'editor-signature',
                fieldType: 'signature',
                label: 'Editor Signature',
                required: true,
            }
        ],
        status: 'active',
        createdAt: '2025-05-22T10:10:00Z',
        updatedAt: '2025-09-25T09:55:00Z',
        createdBy: 'emily.brown@university.edu',
        tags: ['approval', 'editor'],
        reviewerNotes: 'Submit at least three days before the scheduled defense.',
    }
];

/**
 * Mock assignments derived from the templates above.
 */
export const formAssignments: FormAssignment[] = [
    {
        id: 'assignment-progress-001',
        templateId: 'student-progress-update',
        title: 'Progress Update – Week of Oct 28',
        audience: 'student',
        status: 'inProgress',
        dueDate: '2025-11-04',
        assignedTo: ['john.doe@university.edu', 'sarah.wilson@university.edu'],
        lastUpdated: '2025-10-30T15:45:00Z',
        notes: 'Focus on Chapter 3 methodology updates.',
    },
    {
        id: 'assignment-ethics-2025',
        templateId: 'student-ethics-clearance',
        title: 'Ethics Compliance Renewal 2025',
        audience: 'student',
        status: 'pending',
        dueDate: '2025-11-15',
        assignedTo: ['alex.chen@university.edu'],
        lastUpdated: '2025-10-28T09:00:00Z',
        requiresSignature: true,
    },
    {
        id: 'assignment-eval-001',
        templateId: 'reviewer-evaluation',
        title: 'Chapter 3 – Adviser Evaluation',
        audience: 'adviser',
        status: 'pending',
        dueDate: '2025-11-06',
        assignedTo: ['jane.smith@university.edu'],
        lastUpdated: '2025-10-30T12:15:00Z',
        requiresSignature: true,
        notes: 'Student submitted a revised methodology with updated sampling plan.',
    },
    {
        id: 'assignment-editor-approval',
        templateId: 'editor-final-approval',
        title: 'Final Manuscript Approval – Machine Learning in EdTech',
        audience: 'editor',
        status: 'pending',
        dueDate: '2025-11-18',
        assignedTo: ['mike.johnson@university.edu'],
        lastUpdated: '2025-10-29T08:30:00Z',
        requiresSignature: true,
        notes: 'Awaiting confirmation after formatting fixes.',
    }
];
