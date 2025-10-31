import type { ChatMessage } from '../types/chat';
import type { ReviewerAssignment, ReviewerRole, ReviewerWorkspace } from '../types/reviewer';
import type { ThesisData } from '../types/thesis';
import type { FileAttachment } from '../types/file';
import { mockAllTheses, mockThesisData, mockFileRegistry } from './mockData';

/**
 * Utility guard that removes undefined entries from arrays.
 */
function filterDefined<T>(items: (T | undefined)[]): T[] {
    return items.filter((item): item is T => item !== undefined && item !== null);
}

/**
 * Build a slug suitable for lookups based on the thesis title.
 */
function buildThesisSlug(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Calculate the proportion of chapters that reached the approved state.
 */
function calculateCompletionRatio(thesis: ThesisData): number {
    const total = thesis.chapters.length || 1;
    const approved = thesis.chapters.filter((chapter) => chapter.status === 'approved').length;
    return Number((approved / total).toFixed(2));
}

/**
 * Mapping between thesis slug identifiers and the concrete thesis records.
 */
const thesisBySlug = new Map<string, ThesisData>();
mockAllTheses.forEach((thesis) => {
    thesisBySlug.set(buildThesisSlug(thesis.title), thesis);
});

// Ensure the primary mock thesis is also present even if duplicated.
thesisBySlug.set(buildThesisSlug(mockThesisData.title), mockThesisData);

/**
 * Mock reviewer assignments spanning advisers and editors.
 */
export const reviewerAssignments: ReviewerAssignment[] = [
    {
        id: 'assignment-ml-editor',
        thesisId: buildThesisSlug(mockThesisData.title),
        thesisTitle: mockThesisData.title,
        role: 'editor',
        stage: mockThesisData.overallStatus,
        progress: calculateCompletionRatio(mockThesisData),
        dueDate: '2025-11-07',
        assignedTo: [mockThesisData.editor],
        priority: 'high',
        lastUpdated: '2025-10-29T17:20:00Z',
        studentEmails: [mockThesisData.leader, ...mockThesisData.members],
    },
    {
        id: 'assignment-ml-adviser',
        thesisId: buildThesisSlug(mockThesisData.title),
        thesisTitle: mockThesisData.title,
        role: 'adviser',
        stage: mockThesisData.overallStatus,
        progress: calculateCompletionRatio(mockThesisData),
        dueDate: '2025-11-05',
        assignedTo: [mockThesisData.adviser],
        priority: 'medium',
        lastUpdated: '2025-10-30T09:10:00Z',
        studentEmails: [mockThesisData.leader, ...mockThesisData.members],
    },
    ...mockAllTheses.slice(1, 4).flatMap((thesis, index) => {
        const slug = buildThesisSlug(thesis.title);
        const baseAssignment: ReviewerAssignment = {
            id: `assignment-${slug}-${index}`,
            thesisId: slug,
            thesisTitle: thesis.title,
            role: 'adviser',
            stage: thesis.overallStatus,
            progress: calculateCompletionRatio(thesis),
            dueDate: '2025-11-12',
            assignedTo: [thesis.adviser],
            priority: 'medium',
            lastUpdated: '2025-10-26T12:00:00Z',
            studentEmails: [thesis.leader, ...thesis.members],
        };

        const editorAssignment: ReviewerAssignment = {
            ...baseAssignment,
            id: `${baseAssignment.id}-editor`,
            role: 'editor',
            assignedTo: [thesis.editor],
            priority: 'low',
            dueDate: '2025-11-18',
        };

        return [baseAssignment, editorAssignment];
    })
];

/**
 * Pre-canned reviewer workspaces keyed by thesis slug.
 */
const reviewerWorkspaces: ReviewerWorkspace[] = [
    {
        thesisId: buildThesisSlug(mockThesisData.title),
        summary: 'Students delivered a revised methodology draft addressing sampling and instrumentation. Adviser feedback pending sign-off.',
        focusChapters: [2, 3],
        recentFileHashes: filterDefined<string>(['m7n8o9p0', 'g7h8i9j0', 'k1l2m3n4']),
        chatMessages: [
            {
                id: 'ml-msg-1',
                senderId: mockThesisData.editor,
                senderRole: 'editor',
                content: 'I reviewed the latest methodology draft. Please double-check the sampling justification section.',
                timestamp: '2025-10-28T14:05:00Z',
                attachments: filterDefined<FileAttachment>([mockFileRegistry['m7n8o9p0']]),
            },
            {
                id: 'ml-msg-2',
                senderId: mockThesisData.leader,
                senderRole: 'student',
                content: 'Updated the justification paragraph and attached the revised version.',
                timestamp: '2025-10-28T16:22:00Z',
                attachments: filterDefined<FileAttachment>([mockFileRegistry['c3d4e5f6']]),
            },
            {
                id: 'ml-msg-3',
                senderId: mockThesisData.adviser,
                senderRole: 'adviser',
                content: 'Looks good. I will sign the evaluation form once the tables are reformatted.',
                timestamp: '2025-10-29T08:10:00Z',
            },
            {
                id: 'ml-msg-4',
                senderId: mockThesisData.editor,
                senderRole: 'editor',
                content: 'Noted. Tagging @john.doe to refresh the data table screenshots before Thursday.',
                timestamp: '2025-10-29T08:15:00Z',
            }
        ] satisfies ChatMessage[],
    },
    ...mockAllTheses.slice(1, 3).map((thesis) => ({
        thesisId: buildThesisSlug(thesis.title),
        summary: 'Routine check-in. Ensure documentation stays aligned with department guidance.',
        focusChapters: thesis.chapters.filter((chapter) => chapter.status !== 'approved').map((chapter) => chapter.id),
        recentFileHashes: thesis.chapters.flatMap((chapter) => chapter.submissions).slice(-3),
        chatMessages: [
            {
                id: `${buildThesisSlug(thesis.title)}-msg-1`,
                senderId: thesis.adviser,
                senderRole: 'adviser',
                content: 'Reminder: Please share the revised abstract by Friday.',
                timestamp: '2025-10-27T10:00:00Z',
            },
            {
                id: `${buildThesisSlug(thesis.title)}-msg-2`,
                senderId: thesis.leader,
                senderRole: 'student',
                content: 'Copy that. We are polishing the diagrams and will upload soon.',
                timestamp: '2025-10-27T12:45:00Z',
            }
        ] satisfies ChatMessage[],
    }))
];

/**
 * Retrieve reviewer assignments filtered by role and optionally user email.
 */
export function getReviewerAssignments(role: ReviewerRole, userEmail?: string): ReviewerAssignment[] {
    return reviewerAssignments
        .filter((assignment) => assignment.role === role)
        .filter((assignment) => !userEmail || assignment.assignedTo.includes(userEmail))
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
}

/**
 * Fetch workspace context for a specific thesis slug.
 */
export function getReviewerWorkspace(thesisId: string): ReviewerWorkspace | undefined {
    return reviewerWorkspaces.find((workspace) => workspace.thesisId === thesisId);
}

/**
 * Lookup helper returning the thesis record for a slug.
 */
export function getThesisBySlug(thesisId: string): ThesisData | undefined {
    return thesisBySlug.get(thesisId);
}

/**
 * Convenience helper to create or resolve a thesis slug.
 */
export function resolveThesisSlug(thesisTitle: string): string {
    return buildThesisSlug(thesisTitle);
}
