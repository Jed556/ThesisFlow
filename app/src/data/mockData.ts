import type { ThesisData } from '../types/thesis';
import type { FileRegistryEntry } from '../types/file';
import type { UserProfile } from '../types/profile';

/**
 * Centralized mock data for the ThesisFlow application
 * This file contains all dummy/mock data used across the application
 * to ensure consistency and easy maintenance.
 */

/**
 * Centralized file registry with unique hashes
 * All files in the system are stored here with hash-based references
 */
export const mockFileRegistry: Record<string, FileRegistryEntry> = {
    // Chapter 1 - Introduction files
    "f1a2b3c4": {
        name: "Chapter_1_Introduction.pdf",
        type: "pdf",
        size: "2.1 MB",
        url: "/uploads/chapter_1_introduction.pdf",
        author: "john.doe@university.edu",
        submissionDate: "2024-02-01 at 2:30 PM",
        category: "submission"
    },
    "a5b6c7d8": {
        name: "introduction_feedback.pdf",
        type: "pdf",
        size: "245 KB",
        url: "/files/introduction_feedback.pdf",
        author: "jane.smith@university.edu",
        submissionDate: "2024-02-10 at 3:20 PM",
        category: "attachment"
    },

    // Chapter 2 - Literature Review files
    "e9f0g1h2": {
        name: "Chapter_2_Literature_Review_v1.docx",
        type: "docx",
        size: "1.6 MB",
        url: "/uploads/chapter_2_literature_review_v1.docx",
        author: "john.doe@university.edu",
        submissionDate: "2024-02-28 at 3:45 PM",
        category: "submission"
    },
    "i3j4k5l6": {
        name: "Chapter_2_Literature_Review_v2.docx",
        type: "docx",
        size: "1.8 MB",
        url: "/uploads/chapter_2_literature_review_v2.docx",
        author: "jane.smith@university.edu",
        submissionDate: "2024-03-01 at 9:15 AM",
        category: "submission"
    },
    "m7n8o9p0": {
        name: "Chapter_2_Literature_Review_v3.docx",
        type: "docx",
        size: "2.2 MB",
        url: "/uploads/chapter_2_literature_review_v3.docx",
        author: "sarah.wilson@university.edu",
        submissionDate: "2024-03-15 at 4:20 PM",
        category: "submission"
    },
    "q1r2s3t4": {
        name: "recent_papers_list.pdf",
        type: "pdf",
        size: "150 KB",
        url: "/files/recent_papers_list.pdf",
        author: "sarah.wilson@university.edu",
        submissionDate: "2024-03-11 at 9:30 AM",
        category: "attachment"
    },

    // Chapter 3 - Methodology files
    "u5v6w7x8": {
        name: "Chapter_3_Methodology_v1.pdf",
        type: "pdf",
        size: "1.2 MB",
        url: "/uploads/chapter_3_methodology_v1.pdf",
        author: "sarah.wilson@university.edu",
        submissionDate: "2024-03-20 at 2:15 PM",
        category: "submission"
    },
    "y9z0a1b2": {
        name: "Chapter_3_Methodology_v2.pdf",
        type: "pdf",
        size: "1.4 MB",
        url: "/uploads/chapter_3_methodology_v2.pdf",
        author: "mike.johnson@university.edu",
        submissionDate: "2024-03-25 at 11:20 AM",
        category: "submission"
    },
    "c3d4e5f6": {
        name: "Chapter_3_Methodology_v3.pdf",
        type: "pdf",
        size: "1.5 MB",
        url: "/uploads/chapter_3_methodology_v3.pdf",
        author: "mike.johnson@university.edu",
        submissionDate: "2024-04-01 at 4:45 PM",
        category: "submission"
    },
    "g7h8i9j0": {
        name: "methodology_guidelines.pdf",
        type: "pdf",
        size: "890 KB",
        url: "/files/methodology_guidelines.pdf",
        author: "david.kim@university.edu",
        submissionDate: "2024-04-18 at 1:20 PM",
        category: "attachment"
    },

    // Chapter 4 - Results files
    "k1l2m3n4": {
        name: "Chapter_4_Results_Analysis_draft.pdf",
        type: "pdf",
        size: "800 KB",
        url: "/uploads/chapter_4_results_analysis_draft.pdf",
        author: "alex.chen@university.edu",
        submissionDate: "2024-05-03 at 2:15 PM",
        category: "submission"
    },

    // Chapter 5 - Conclusion files
    "o5p6q7r8": {
        name: "Chapter_5_Conclusion_outline.pdf",
        type: "pdf",
        size: "350 KB",
        url: "/uploads/chapter_5_conclusion_outline.pdf",
        author: "maria.garcia@university.edu",
        submissionDate: "2024-05-06 at 10:30 AM",
        category: "submission"
    }
};

export const mockThesisData: ThesisData = {
    title: "Machine Learning Applications in Educational Technology: A Comprehensive Study",
    leader: "john.doe@university.edu",
    members: ["sarah.wilson@university.edu", "alex.chen@university.edu", "maria.garcia@university.edu"],
    adviser: "jane.smith@university.edu",
    editor: "mike.johnson@university.edu",
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
            submissions: ["f1a2b3c4"], // Chapter 1 Introduction PDF
            comments: [
                {
                    author: "jane.smith@university.edu",
                    date: "2024-02-10 at 3:20 PM",
                    comment: "Excellent introduction. Clear problem statement and well-defined objectives.",
                    version: 1,
                    attachments: ["a5b6c7d8"] // introduction_feedback.pdf
                },
                {
                    author: "mike.johnson@university.edu",
                    date: "2024-02-12 at 10:15 AM",
                    comment: "The writing is clear and well-structured. Consider adding a brief section on the significance of your research.",
                    version: 1,
                    attachments: []
                },
                {
                    author: "john.doe@university.edu",
                    date: "2024-02-13 at 2:30 PM",
                    comment: "Thank you for the feedback! I'll add a significance section and revise the objectives for clarity.",
                    version: 1,
                    attachments: []
                }
            ]
        },
        {
            id: 2,
            title: "Literature Review",
            status: "under_review",
            submissionDate: "2024-03-01 at 9:15 AM",
            lastModified: "2024-03-15 at 1:20 PM",
            submissions: ["e9f0g1h2", "i3j4k5l6", "m7n8o9p0"], // All versions of Literature Review
            comments: [
                {
                    author: "jane.smith@university.edu",
                    date: "2024-03-10 at 1:15 PM",
                    comment: "Good coverage of existing research. Consider adding more recent studies from 2023-2024.",
                    version: 2,
                    attachments: []
                },
                {
                    author: "mike.johnson@university.edu",
                    date: "2024-02-29 at 4:20 PM",
                    comment: "First version had good structure but needs more comprehensive literature coverage. Please expand the theoretical framework section.",
                    version: 1,
                    attachments: []
                },
                {
                    author: "sarah.wilson@university.edu",
                    date: "2024-03-11 at 9:30 AM",
                    comment: "I've found several recent papers on neural networks in education. Should I include them in section 2.3?",
                    version: 2,
                    attachments: ["q1r2s3t4"] // recent_papers_list.pdf
                },
                {
                    author: "jane.smith@university.edu",
                    date: "2024-03-11 at 2:45 PM",
                    comment: "Yes, please include those papers. They would strengthen your argument in section 2.3. Also consider adding a comparison table.",
                    version: 2,
                    attachments: []
                },
                {
                    author: "alex.chen@university.edu",
                    date: "2024-03-12 at 11:20 AM",
                    comment: "I can help with creating the comparison table. I have experience with similar analysis from my previous project.",
                    version: 2,
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
            submissions: ["u5v6w7x8", "y9z0a1b2", "c3d4e5f6"], // All versions of Methodology
            comments: [
                {
                    author: "jane.smith@university.edu",
                    date: "2024-04-15 at 11:30 AM",
                    comment: "The research design needs clarification. Please provide more details on data collection methods.",
                    version: 2,
                    attachments: []
                },
                {
                    author: "mike.johnson@university.edu",
                    date: "2024-04-02 at 9:45 AM",
                    comment: "Version 3 shows significant improvement in methodology description. Statistical analysis section is much clearer now.",
                    version: 3,
                    attachments: []
                },
                {
                    author: "jane.smith@university.edu",
                    date: "2024-03-21 at 2:30 PM",
                    comment: "Initial methodology draft needs substantial revision. Data collection approach is unclear and sample size justification is missing.",
                    version: 1,
                    attachments: []
                },
                {
                    author: "john.doe@university.edu",
                    date: "2024-04-16 at 3:45 PM",
                    comment: "Thank you for the feedback! I've updated the data collection section and added justification for the sample size. Please let me know if you need any clarification.",
                    version: 2,
                    attachments: []
                },
                {
                    author: "maria.garcia@university.edu",
                    date: "2024-04-17 at 10:15 AM",
                    comment: "I've reviewed the statistical analysis approach and it looks solid. The power analysis section is particularly well done.",
                    version: 3,
                    attachments: []
                },
                {
                    author: "david.kim@university.edu",
                    date: "2024-04-18 at 1:20 PM",
                    comment: "Consider adding a section on potential limitations and bias mitigation strategies. This would strengthen the methodology significantly.",
                    version: 3,
                    attachments: ["g7h8i9j0"] // methodology_guidelines.pdf
                },
                {
                    author: "sarah.wilson@university.edu",
                    date: "2024-04-19 at 8:30 AM",
                    comment: "I can work on the limitations section. I've identified several potential sources of bias that we should address.",
                    version: 3,
                    attachments: []
                },
                {
                    author: "emily.brown@university.edu",
                    date: "2024-04-20 at 4:45 PM",
                    comment: "The writing quality has improved significantly. Minor formatting issues in the tables need to be addressed before final submission.",
                    version: 3,
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
            submissions: ["k1l2m3n4"], // Chapter 4 draft
            comments: [
                {
                    author: "jane.smith@university.edu",
                    date: "2024-05-01 at 2:15 PM",
                    comment: "Looking forward to seeing the results. Make sure to include both quantitative and qualitative analysis as discussed.",
                    version: 1,
                    attachments: []
                },
                {
                    author: "john.doe@university.edu",
                    date: "2024-05-02 at 9:30 AM",
                    comment: "Currently working on data visualization. Should have the first draft ready by next week.",
                    version: 1,
                    attachments: []
                }
            ]
        },
        {
            id: 5,
            title: "Conclusion",
            status: "not_submitted",
            submissionDate: null,
            lastModified: null,
            submissions: ["o5p6q7r8"], // Chapter 5 outline
            comments: [
                {
                    author: "mike.johnson@university.edu",
                    date: "2024-05-05 at 11:00 AM",
                    comment: "For the conclusion, focus on practical implications and future research directions. Keep it concise but impactful.",
                    version: 1,
                    attachments: []
                },
                {
                    author: "alex.chen@university.edu",
                    date: "2024-05-05 at 3:20 PM",
                    comment: "I can help with the future research section. I've been collecting ideas throughout our research process.",
                    version: 1,
                    attachments: []
                }
            ]
        }
    ]
};

/**
 * Mock data for user profiles
 */
export const mockUserProfiles: UserProfile[] = [
    {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@university.edu",
        role: "student",
        department: "Computer Science"
    },
    {
        id: 2,
        prefix: "Dr.",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@university.edu",
        role: "adviser",
        department: "Computer Science"
    },
    {
        id: 3,
        prefix: "Prof.",
        firstName: "Michael",
        lastName: "Johnson",
        email: "mike.johnson@university.edu",
        role: "editor",
        department: "Educational Technology"
    },
    {
        id: 4,
        firstName: "Sarah",
        lastName: "Wilson",
        email: "sarah.wilson@university.edu",
        role: "student",
        department: "Computer Science"
    },
    {
        id: 5,
        firstName: "Alex",
        lastName: "Chen",
        email: "alex.chen@university.edu",
        role: "student",
        department: "Computer Science"
    },
    {
        id: 6,
        firstName: "Maria",
        lastName: "Garcia",
        email: "maria.garcia@university.edu",
        role: "student",
        department: "Data Science"
    },
    {
        id: 7,
        prefix: "Dr.",
        firstName: "David",
        lastName: "Kim",
        email: "david.kim@university.edu",
        role: "adviser",
        department: "Educational Technology"
    },
    {
        id: 8,
        prefix: "Prof.",
        firstName: "Emily",
        lastName: "Brown",
        email: "emily.brown@university.edu",
        role: "editor",
        department: "Computer Science"
    },
    {
        id: 9,
        firstName: "Robert",
        lastName: "Lee",
        email: "robert.lee@university.edu",
        role: "student",
        department: "Information Systems"
    },
    {
        id: 10,
        prefix: "Dr.",
        firstName: "Lisa",
        lastName: "Wang",
        email: "lisa.wang@university.edu",
        role: "adviser",
        department: "Machine Learning"
    }
];
