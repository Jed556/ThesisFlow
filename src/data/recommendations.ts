import type { RecommendationEntry } from '../types/recommendation';

/**
 * Mock recommendation data that powers the student-facing adviser and editor pages.
 */
export const adviserRecommendations: RecommendationEntry[] = [
    {
        id: 101,
        userEmail: 'jane.smith@university.edu',
        role: 'adviser',
        expertiseAreas: [
            'Learning analytics',
            'Curriculum design',
            'Quantitative research methods'
        ],
        recentProjects: [
            'Predictive analytics for student retention',
            'Adaptive learning platforms for STEM'
        ],
        matchScore: 94,
        currentAssignments: 2,
        capacity: 4,
        avgResponseHours: 18,
        notes: 'Strong background in educational data mining with excellent availability this semester.'
    },
    {
        id: 102,
        userEmail: 'david.kim@university.edu',
        role: 'adviser',
        expertiseAreas: [
            'Experimental design',
            'AI in education',
            'Mixed-methods research'
        ],
        recentProjects: [
            'Virtual lab design for teacher training',
            'Bias detection in adaptive testing systems'
        ],
        matchScore: 88,
        currentAssignments: 3,
        capacity: 5,
        avgResponseHours: 12,
        notes: 'Ideal for teams exploring AI-driven classroom tooling with a research-heavy scope.'
    },
    {
        id: 103,
        userEmail: 'lisa.wang@university.edu',
        role: 'adviser',
        expertiseAreas: [
            'Machine learning',
            'Data visualization',
            'Human-centered design'
        ],
        recentProjects: [
            'Explainable AI dashboards for educators',
            'Student engagement analytics for MOOCs'
        ],
        matchScore: 82,
        currentAssignments: 4,
        capacity: 5,
        avgResponseHours: 26,
        notes: 'High demand but still accepting new teams focused on ML + UX intersections.'
    }
];

export const editorRecommendations: RecommendationEntry[] = [
    {
        id: 201,
        userEmail: 'mike.johnson@university.edu',
        role: 'editor',
        expertiseAreas: [
            'Technical writing',
            'IEEE formatting',
            'Statistical reporting'
        ],
        recentProjects: [
            'Automation of rubric-based feedback workflows',
            'Collaborative editing for VR-based learning research'
        ],
        matchScore: 92,
        currentAssignments: 3,
        capacity: 6,
        avgResponseHours: 20,
        notes: 'Known for detailed methodology reviews and fast iteration cycles.'
    },
    {
        id: 202,
        userEmail: 'emily.brown@university.edu',
        role: 'editor',
        expertiseAreas: [
            'Publication strategy',
            'Qualitative analysis narratives',
            'APA 7th edition compliance'
        ],
        recentProjects: [
            'Reflective journals in hybrid classrooms',
            'Longitudinal studies on remote learning outcomes'
        ],
        matchScore: 86,
        currentAssignments: 4,
        capacity: 5,
        avgResponseHours: 28,
        notes: 'Excels at crafting persuasive conclusions and aligning manuscripts with journal scopes.'
    },
    {
        id: 203,
        userEmail: 'olivia.martinez@university.edu',
        role: 'editor',
        expertiseAreas: [
            'Data storytelling',
            'UX copy editing',
            'Conference presentation prep'
        ],
        recentProjects: [
            'Immersive analytics dashboards for thesis defenses',
            'Story-driven reporting for educational simulations'
        ],
        matchScore: 79,
        currentAssignments: 2,
        capacity: 4,
        avgResponseHours: 16,
        notes: 'Great fit for teams prioritizing clarity in data visualizations and presentations.'
    }
];
