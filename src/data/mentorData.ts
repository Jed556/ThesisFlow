/**
 * Shared mentor-specific data for recommendations and profile views.
 */
import type { HistoricalThesisEntry } from '../types/profile';

/**
 * Static mapping of mentor skill tags keyed by email address.
 * Replace with API-backed data once available.
 */
export const mentorSkills: Record<string, string[]> = {
    'jane.smith@university.edu': ['Machine Learning', 'Educational Analytics', 'UX Research'],
    'david.kim@university.edu': ['IoT Security', 'Systems Architecture', 'Data Ethics'],
    'lisa.wang@university.edu': ['Natural Language Processing', 'Deep Learning', 'AI Evaluation'],
    'mike.johnson@university.edu': ['Technical Writing', 'Copy Editing', 'APA Compliance'],
    'emily.brown@university.edu': ['Qualitative Review', 'Academic Editing', 'Rubric Design'],
    'olivia.martinez@university.edu': ['Instructional Design', 'Accessibility', 'Learning Experience'],
};

/**
 * Static timeline data describing prior thesis advisories and editorial work.
 */
export const mentorHistory: Record<string, HistoricalThesisEntry[]> = {
    'jane.smith@university.edu': [
        { year: '2023', title: 'AI-Driven Advising Systems', role: 'Adviser', outcome: 'Passed with distinction' },
        { year: '2022', title: 'Learning Analytics Dashboard', role: 'Adviser', outcome: 'Published in IEEE EDUCON' },
    ],
    'david.kim@university.edu': [
        { year: '2023', title: 'Autonomous Campus IoT Mesh', role: 'Adviser', outcome: 'Best hardware project' },
        { year: '2021', title: 'Secure Smart Dorm Architecture', role: 'Adviser', outcome: 'Adopted by partner campus' },
    ],
    'lisa.wang@university.edu': [
        { year: '2022', title: 'Hybrid Sentiment Models', role: 'Adviser', outcome: 'Journal submission pending' },
        { year: '2020', title: 'Speech-to-Text for ESL Learners', role: 'Adviser', outcome: 'Presented at ACL Workshop' },
    ],
    'mike.johnson@university.edu': [
        { year: '2023', title: 'Narrative Analytics in Education', role: 'Editor', outcome: 'Published in Springer EDU' },
        { year: '2021', title: 'Cognitive Load Research', role: 'Editor', outcome: 'Best written thesis award' },
    ],
    'emily.brown@university.edu': [
        { year: '2022', title: 'Cross-cultural Instructional Materials', role: 'Editor', outcome: 'Ready for book chapter' },
        { year: '2020', title: 'AR storytelling for STEM', role: 'Editor', outcome: 'Passed with commendation' },
    ],
    'olivia.martinez@university.edu': [
        { year: '2023', title: 'Immersive Learning Pods', role: 'Editor', outcome: 'Gold award at EduTech Summit' },
        { year: '2021', title: 'Assistive Platforms for Assessment', role: 'Editor', outcome: 'Implemented campus-wide' },
    ],
};

/**
 * Utility helpers for accessing mentor metadata safely.
 */
export function getMentorSkills(email: string): string[] {
    return mentorSkills[email] ?? [];
}

export function getMentorHistory(email: string): HistoricalThesisEntry[] {
    return mentorHistory[email] ?? [];
}
