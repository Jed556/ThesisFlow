import type { ThesisData, FileAttachment } from '../types/thesis';

/**
 * Centralized mock data for the ThesisFlow application
 * This file contains all dummy/mock data used across the application
 * to ensure consistency and easy maintenance.
 */

export const mockThesisData: ThesisData = {
    title: "Machine Learning Applications in Educational Technology: A Comprehensive Study",
    student: "John Doe",
    adviser: "Dr. Jane Smith",
    editor: "Prof. Michael Johnson",
    submissionDate: "2024-01-15 at 9:00 AM",
    lastUpdated: "2024-08-20 at 4:30 PM",
    overallStatus: "In Progress",
    chapters: [
        {
            id: 1,
            title: "Introduction",
            status: "approved",
            submissionDate: "2024-02-01 at 2:30 PM",
            lastModified: "2024-02-15 at 5:45 PM",
            comments: [
                {
                    author: "Dr. Jane Smith",
                    role: "adviser",
                    date: "2024-02-10 at 3:20 PM",
                    comment: "Excellent introduction. Clear problem statement and well-defined objectives.",
                    documentVersion: 1,
                    documentName: "Chapter_1_Introduction.pdf",
                    attachments: [
                        {
                            name: "introduction_feedback.pdf",
                            type: "pdf",
                            size: "245 KB",
                            url: "/files/introduction_feedback.pdf"
                        }
                    ]
                }
            ]
        },
        {
            id: 2,
            title: "Literature Review",
            status: "under_review",
            submissionDate: "2024-03-01 at 9:15 AM",
            lastModified: "2024-03-15 at 1:20 PM",
            comments: [
                {
                    author: "Dr. Jane Smith",
                    role: "adviser",
                    date: "2024-03-10 at 1:15 PM",
                    comment: "Good coverage of existing research. Consider adding more recent studies from 2023-2024.",
                    documentVersion: 2,
                    documentName: "Chapter_2_Literature_Review_v2.docx",
                    attachments: []
                },
                {
                    author: "Prof. Michael Johnson",
                    role: "editor",
                    date: "2024-02-29 at 4:20 PM",
                    comment: "First version had good structure but needs more comprehensive literature coverage. Please expand the theoretical framework section.",
                    documentVersion: 1,
                    documentName: "Chapter_2_Literature_Review_v1.docx",
                    attachments: []
                }
            ]
        },
        {
            id: 3,
            title: "Methodology",
            status: "revision_required",
            submissionDate: "2024-04-01 at 4:45 PM",
            lastModified: "2024-04-20 at 8:30 AM",
            comments: [
                {
                    author: "Dr. Jane Smith",
                    role: "adviser",
                    date: "2024-04-15 at 11:30 AM",
                    comment: "The research design needs clarification. Please provide more details on data collection methods.",
                    documentVersion: 2,
                    documentName: "Chapter_3_Methodology_v2.pdf",
                    attachments: []
                },
                {
                    author: "Prof. Michael Johnson",
                    role: "editor",
                    date: "2024-04-02 at 9:45 AM",
                    comment: "Version 3 shows significant improvement in methodology description. Statistical analysis section is much clearer now.",
                    documentVersion: 3,
                    documentName: "Chapter_3_Methodology_v3.pdf",
                    attachments: []
                },
                {
                    author: "Dr. Jane Smith",
                    role: "adviser",
                    date: "2024-03-21 at 2:30 PM",
                    comment: "Initial methodology draft needs substantial revision. Data collection approach is unclear and sample size justification is missing.",
                    documentVersion: 1,
                    documentName: "Chapter_3_Methodology_v1.pdf",
                    attachments: []
                }
            ]
        },
        {
            id: 4,
            title: "Results and Analysis",
            status: "not_submitted",
            submissionDate: null,
            lastModified: null,
            comments: []
        },
        {
            id: 5,
            title: "Conclusion",
            status: "not_submitted",
            submissionDate: null,
            lastModified: null,
            comments: []
        }
    ]
};

/**
 * Mock data for group members
 */
export const mockGroupMembers = [
    { id: 1, name: "John Doe", email: "john.doe@university.edu", role: "Team Leader" },
    { id: 2, name: "Jane Smith", email: "jane.smith@university.edu", role: "Researcher" },
    { id: 3, name: "Mike Johnson", email: "mike.johnson@university.edu", role: "Data Analyst" },
    { id: 4, name: "Sarah Wilson", email: "sarah.wilson@university.edu", role: "Writer" }
];

/**
 * Mock uploaded files for each chapter with submitter info and version history
 */
export const mockChapterFiles: Record<number, (FileAttachment & {
    submittedBy: string;
    submittedByEmail: string;
    submissionDate: string;
    version: number;
    status: 'current' | 'previous'
})[]> = {
    1: [
        {
            name: "Chapter_1_Introduction.pdf",
            type: "pdf",
            size: "2.1 MB",
            url: "/uploads/chapter_1_introduction.pdf",
            submittedBy: "John Doe",
            submittedByEmail: "john.doe@university.edu",
            submissionDate: "2024-02-01 at 2:30 PM",
            version: 1,
            status: "current"
        }
    ],
    2: [
        {
            name: "Chapter_2_Literature_Review_v2.docx",
            type: "docx",
            size: "1.8 MB",
            url: "/uploads/chapter_2_literature_review_v2.docx",
            submittedBy: "Jane Smith",
            submittedByEmail: "jane.smith@university.edu",
            submissionDate: "2024-03-01 at 9:15 AM",
            version: 2,
            status: "current"
        },
        {
            name: "Chapter_2_Literature_Review_v1.docx",
            type: "docx",
            size: "1.6 MB",
            url: "/uploads/chapter_2_literature_review_v1.docx",
            submittedBy: "Jane Smith",
            submittedByEmail: "jane.smith@university.edu",
            submissionDate: "2024-02-28 at 3:45 PM",
            version: 1,
            status: "previous"
        }
    ],
    3: [
        {
            name: "Chapter_3_Methodology_v3.pdf",
            type: "pdf",
            size: "1.5 MB",
            url: "/uploads/chapter_3_methodology_v3.pdf",
            submittedBy: "Mike Johnson",
            submittedByEmail: "mike.johnson@university.edu",
            submissionDate: "2024-04-01 at 4:45 PM",
            version: 3,
            status: "current"
        },
        {
            name: "Chapter_3_Methodology_v2.pdf",
            type: "pdf",
            size: "1.4 MB",
            url: "/uploads/chapter_3_methodology_v2.pdf",
            submittedBy: "Mike Johnson",
            submittedByEmail: "mike.johnson@university.edu",
            submissionDate: "2024-03-25 at 11:20 AM",
            version: 2,
            status: "previous"
        },
        {
            name: "Chapter_3_Methodology_v1.pdf",
            type: "pdf",
            size: "1.2 MB",
            url: "/uploads/chapter_3_methodology_v1.pdf",
            submittedBy: "Sarah Wilson",
            submittedByEmail: "sarah.wilson@university.edu",
            submissionDate: "2024-03-20 at 2:15 PM",
            version: 1,
            status: "previous"
        }
    ]
};

/**
 * Helper function to get version history for a specific chapter
 */
export function getVersionHistory(chapterId: number) {
    const files = mockChapterFiles[chapterId] || [];
    return files.filter(file => file.status === 'previous').sort((a, b) => b.version - a.version);
}

/**
 * Helper function to get the current version for a specific chapter
 */
export function getCurrentVersion(chapterId: number) {
    const files = mockChapterFiles[chapterId] || [];
    return files.filter(file => file.status === 'current');
}

/**
 * Helper function to get all versions for a specific chapter
 */
export function getAllVersions(chapterId: number) {
    const files = mockChapterFiles[chapterId] || [];
    return files.sort((a, b) => b.version - a.version);
}

/**
 * Helper function to get group member by name
 */
export function getGroupMember(name: string) {
    return mockGroupMembers.find(member => member.name === name);
}

/**
 * Helper function to calculate thesis progress
 */
export function calculateProgress() {
    const total = mockThesisData.chapters.length;
    const approved = mockThesisData.chapters.filter(ch => ch.status === 'approved').length;
    return (approved / total) * 100;
}
