/* eslint-env node */
/**
 * Utility script to generate expanded mock CSV datasets for ThesisFlow.
 * The script produces 100 representative rows for each CSV handler.
 */

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { log } from 'node:console';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

let RECORD_COUNT = 100;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseDir = resolve(__dirname, '..', 'mock', 'csv');

const pad = (value, size = 3) => String(value).padStart(size, '0');
const escapeCsv = value => {
    if (value === null || value === undefined) {
        return '';
    }
    const stringValue = String(value);
    if (stringValue === '') {
        return '';
    }
    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

const firstNames = [
    'Alex', 'Jamie', 'Taylor', 'Jordan', 'Morgan', 'Sydney', 'Avery', 'Casey', 'Riley', 'Hayden',
    'Peyton', 'Dakota', 'Quinn', 'Rowan', 'Skyler', 'Emerson', 'Harper', 'Logan', 'Parker', 'Reese',
    'Noah', 'Liam', 'Olivia', 'Emma', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Evelyn',
    'Benjamin', 'Lucas', 'Mason', 'Ethan', 'James', 'William', 'Henry', 'Sebastian', 'Mateo', 'Jack',
    'Zoe', 'Chloe', 'Luna', 'Ellie', 'Nora', 'Camila', 'Aurora', 'Victoria'
];
// Family names (used as the primary pool for last and middle/family names)
const familyNames = [
    'Anderson', 'Brooks', 'Campbell', 'Dawson', 'Ellis', 'Fletcher', 'Garcia', 'Hayes', 'Ibrahim', 'Jensen',
    'Kendall', 'Lopez', 'Monroe', 'Nguyen', 'Owens', 'Patel', 'Quincy', 'Ramirez', 'Singh', 'Turner',
    'Baker', 'Carter', 'Diaz', 'Edwards', 'Fisher', 'Gomez', 'Harris', 'Iverson', 'Jackson', 'Kim',
    'Lopez', 'Marshall', 'Murphy', 'Nash', 'Olsen', 'Perry', 'Reid', 'Santos', 'Torres', 'Ward', 'Young',
    // Additional surnames for greater variety
    'Zimmerman', 'Kaur', 'Velasquez', 'Bennett', 'Griffin', 'Murillo', 'Holmes', 'Powers', 'Vega', 'Bennett',
    'Abbott', 'Conner', 'Reynolds', 'Schmidt', 'Knight', 'Walsh', 'Armstrong', 'Friedman', 'Lopez-Rodriguez', 'Chung'
];
const departments = [
    'School of Nursing',
    'School of Computer Studies and Technology',
    'School of Education, Arts, and Sciences',
    'School of Tourism and Hospitality Management',
    'School of Business, Management, and Accountancy',
    'School of Engineering and Architecture',
    'Research Department',
    'IT Department',
];
const coursesByDepartment = {
    'School of Nursing': ['BS Nursing', 'BS Midwifery', 'BS Medical Technology'],
    'School of Computer Studies and Technology': ['BS Computer Science', 'BS Information Technology', 'BS Information Systems'],
    'School of Education, Arts, and Sciences': ['BA Communication', 'BS Psychology', 'BA English Language Studies'],
    'School of Tourism and Hospitality Management': ['BS Tourism Management', 'BS Hospitality Management'],
    'School of Business, Management, and Accountancy': ['BS Business Administration', 'BS Accountancy', 'BS Management Accounting'],
    'School of Engineering and Architecture': ['BS Civil Engineering', 'BS Mechanical Engineering', 'BS Architecture'],
    'Research Department': ['Graduate Research Studies'],
    'IT Department': ['IT Operations', 'Systems Administration'],
};
const thesisTopics = [
    'Autonomous Systems', 'Renewable Energy Forecasting', 'Digital Preservation', 'Smart Agriculture',
    'Medical Imaging AI', 'Cybersecurity Analytics', 'Human-Computer Interaction', 'Sustainable Materials',
    'Financial Risk Modeling', 'Neural Language Processing', 'Urban Mobility Optimization', 'Climate Impact Modeling',
    'Edge Computing', 'Quantum Communication', 'Assistive Robotics', 'Biometric Security', 'XR Learning Environments',
    'Cultural Heritage Digitization', 'Precision Medicine', 'Clean Water Solutions',
];
// (removed unused top-level calendarIds constant — schedule generator accepts calendars as an argument)
const eventStatuses = ['scheduled', 'confirmed', 'cancelled', 'completed', 'rescheduled'];
const participantStatuses = ['accepted', 'declined', 'pending', 'tentative'];
const eventTags = ['defense', 'proposal', 'check-in', 'editing', 'milestone', 'review', 'planning', 'training'];
const eventColors = ['#3949AB', '#1E88E5', '#8E24AA', '#D81B60', '#00897B', '#F4511E', '#6D4C41'];
const fileTypes = [
    { ext: 'pdf', mime: 'application/pdf', category: 'submission' },
    { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'submission' },
    { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', category: 'submission' },
    { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'attachment' },
    { ext: 'csv', mime: 'text/csv', category: 'attachment' },
    { ext: 'zip', mime: 'application/zip', category: 'attachment' },
    { ext: 'mp4', mime: 'video/mp4', category: 'attachment' },
    { ext: 'mp3', mime: 'audio/mpeg', category: 'attachment' },
];
const formAudiences = ['student', 'adviser', 'editor'];
const formStatuses = ['draft', 'active', 'archived'];
const thesisStatuses = ['under_review', 'revision_required', 'approved', 'not_submitted'];
const topicProposalEntryStatuses = ['draft', 'submitted', 'head_review', 'head_approved', 'head_rejected', 'moderator_rejected'];
const MAX_TOPIC_PROPOSALS = 3;

const ROLE_KEYS = ['admin', 'adviser', 'editor', 'panel', 'developer', 'moderator', 'statistician', 'head', 'student'];
const defaultRoleCounts = {
    admin: 9,
    adviser: 12,
    editor: 13,
    panel: 10,
    developer: 1,
    moderator: 3,
    statistician: 2,
    head: 1,
    student: 49,
};
const roleArgMap = {
    admin: 'admins',
    adviser: 'advisers',
    editor: 'editors',
    panel: 'panels',
    developer: 'developers',
    statistician: 'statisticians',
    student: 'students',
};
const rolePromptLabels = {
    admin: 'admins',
    adviser: 'advisers',
    editor: 'editors',
    panel: 'panel members',
    developer: 'developers',
    statistician: 'statisticians',
    student: 'students',
};

const sumRoleCounts = counts => ROLE_KEYS.reduce((total, key) => total + (counts[key] || 0), 0);
const parseCountOrFallback = (value, fallback) => {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return fallback;
};
const scaleRoleCounts = (targetTotal) => {
    const baseTotal = sumRoleCounts(defaultRoleCounts) || 1;
    const scaled = {};
    let assigned = 0;
    ROLE_KEYS.forEach((role, idx) => {
        if (idx === ROLE_KEYS.length - 1) {
            scaled[role] = Math.max(0, targetTotal - assigned);
            return;
        }
        const value = Math.round((defaultRoleCounts[role] / baseTotal) * targetTotal);
        scaled[role] = value;
        assigned += value;
    });
    return scaled;
};

// Default role counts (sum ~100) guide the generated campus mix (students 49, advisers 12, editors 13, panels 10, moderators 3, statisticians 2, heads 1).
// Prefixes used to generate unique UIDs per role
const rolePrefixes = {
    admin: 'ADM',
    developer: 'DEV',
    adviser: 'ADV',
    editor: 'EDT',
    panel: 'PNL',
    moderator: 'MOD',
    statistician: 'STT',
    head: 'HED',
    student: 'STD',
};

const pickWithOffset = (source, index, offset = 0) => source[(index + offset) % source.length];

const pickCourseForDepartment = (department, seed = 0) => {
    const courseOptions = coursesByDepartment[department];
    if (!courseOptions || courseOptions.length === 0) {
        return '';
    }
    const index = Math.abs(seed) % courseOptions.length;
    return courseOptions[index];
};

const buildIso = (baseDate, dayOffset, hourOffset = 9, minuteOffset = 0) => {
    const date = new Date(baseDate.getTime());
    date.setUTCDate(date.getUTCDate() + dayOffset);
    date.setUTCHours(hourOffset, minuteOffset, 0, 0);
    return date.toISOString();
};

const writeCsv = (fileName, headers, rows) => {
    const csvContent = [headers.join(',')]
        .concat(rows.map(row => row.map(escapeCsv).join(',')))
        .join('\n');
    writeFileSync(join(baseDir, fileName), `${csvContent}\n`, 'utf8');
    log(`Generated ${fileName} with ${rows.length} rows.`);
};

// Random utilities
const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const sample = (arr, count) => shuffle(arr).slice(0, count);

// Generate unique thesis titles
const generateUniqueThesisTitles = (count) => {
    const adjectives = ['Advanced', 'Adaptive', 'Scalable', 'Robust', 'Efficient', 'Secure', 'Interactive', 'Autonomous', 'Novel', 'Integrated', 'Hybrid', 'Predictive', 'Generative'];
    const suffixes = ['Framework', 'System', 'Model', 'Approach', 'Platform', 'Pipeline', 'Architecture', 'Method', 'Toolkit'];
    const titles = new Set();
    const results = [];

    while (results.length < count) {
        const topic = thesisTopics[Math.floor(Math.random() * thesisTopics.length)];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
        let title = `${adj} ${topic} ${suf}`;

        if (titles.has(title)) {
            // Append a short random suffix to avoid collisions
            title = `${title} (${Math.floor(Math.random() * 900) + 100})`;
            if (titles.has(title)) continue;
        }

        titles.add(title);
        results.push(title);
    }

    return results;
};

/**
 * Generate users using explicit per-role counts. Defaults follow the historical distribution
 * but callers can override each role to model different campuses or cohorts.
 */
const generateUsers = (roleCounts = defaultRoleCounts) => {
    const normalizedCounts = { ...defaultRoleCounts, ...(roleCounts || {}) };
    const users = [];
    const userEmails = new Map();
    const usersByRole = {
        admin: [],
        adviser: [],
        editor: [],
        panel: [],
        developer: [],
        moderator: [],
        statistician: [],
        head: [],
        student: [],
    };
    const userDetails = new Map();
    const totalUsers = sumRoleCounts(normalizedCounts);

    const rolePlan = [
        { role: 'developer', count: normalizedCounts.developer, prefix: rolePrefixes.developer, honorific: '' },
        { role: 'admin', count: normalizedCounts.admin, prefix: rolePrefixes.admin, honorific: 'Dr.' },
        { role: 'adviser', count: normalizedCounts.adviser, prefix: rolePrefixes.adviser, honorific: 'Prof.' },
        { role: 'editor', count: normalizedCounts.editor, prefix: rolePrefixes.editor, honorific: '' },
        { role: 'panel', count: normalizedCounts.panel, prefix: rolePrefixes.panel, honorific: 'Prof.' },
        { role: 'moderator', count: normalizedCounts.moderator, prefix: rolePrefixes.moderator, honorific: 'Prof.' },
        { role: 'statistician', count: normalizedCounts.statistician, prefix: rolePrefixes.statistician, honorific: '' },
        { role: 'head', count: normalizedCounts.head, prefix: rolePrefixes.head, honorific: 'Head' },
        { role: 'student', count: normalizedCounts.student, prefix: rolePrefixes.student, honorific: '' },
    ];

    let globalIndex = 0;
    // Track used full name combinations to avoid duplicates
    const usedFullNames = new Set();

    // Helper: pick a pseudo-random element from an array using baseIndex and an attempt offset
    const pickRandomWithJitter = (source, baseIndex, attempt = 0) => {
        if (!Array.isArray(source) || source.length === 0) return '';
        const jitter = Math.floor(Math.random() * source.length);
        return source[(baseIndex + jitter + attempt) % source.length];
    };

    // Helper to pick a department that respects role constraints
    const pickDepartmentForRole = (role, idx) => {
        if (role === 'admin') {
            const giveResearch = (idx % 5) === 0; // ~20% of admins in Research
            return giveResearch ? 'Research Department' : pickWithOffset(departments.filter(d => d !== 'Research Department'), idx);
        }
        if (role === 'developer') {
            // Developers must be only from IT Department or School of Computer Studies and Technology
            const devDepts = ['IT Department', 'Research Department'];
            return pickWithOffset(devDepts, idx);
        }
        if (role === 'adviser') {
            // Advisers cannot be from Research Department
            return pickWithOffset(departments.filter(d => d !== 'Research Department' && d !== 'IT Department'), idx + 1);
        }
        if (role === 'editor') {
            // Editors only come from School of Education, Arts, and Sciences
            return 'School of Education, Arts, and Sciences';
        }
        if (role === 'panel') {
            // Panel members are faculty outside Research Department for broader coverage
            return pickWithOffset(departments.filter(d => d !== 'Research Department' && d !== 'IT Department'), idx + 3);
        }
        if (role === 'moderator') {
            const moderatorDepts = departments.filter(d => d !== 'Research Department' && d !== 'IT Department');
            return pickWithOffset(moderatorDepts, idx + 4);
        }
        if (role === 'statistician') {
            const statDepts = departments.filter(d => d !== 'Research Department' && d !== 'IT Department');
            return pickWithOffset(statDepts, idx + 5);
        }
        if (role === 'head') {
            const headDepts = departments.filter(d => d !== 'Research Department' && d !== 'IT Department');
            return pickWithOffset(headDepts, idx + 6);
        }
        if (role === 'student') {
            // Students must not be assigned to Research Department or IT Department
            return pickWithOffset(departments.filter(d => d !== 'Research Department' && d !== 'IT Department'), idx + 2);
        }
        // Fallback for any other role: avoid Research Department and IT Department
        return pickWithOffset(departments.filter(d => d !== 'Research Department' && d !== 'IT Department'), idx + 2);
    };

    for (const plan of rolePlan) {
        const { role, count, prefix, honorific } = plan;
        for (let i = 0; i < count; i += 1) {
            // Pick names with jitter and ensure the full name (first+middle+last) is unique
            let attemptName = 0;
            let firstName;
            let lastName;
            let middleName;
            let fullName;
            while (attemptName < 100) {
                firstName = pickRandomWithJitter(firstNames, globalIndex, i + attemptName);
                lastName = pickRandomWithJitter(familyNames, globalIndex, i * 2 + attemptName);
                // pick a middle/family name but avoid matching the last name
                let midCandidate = pickRandomWithJitter(familyNames, i, attemptName + 1);
                if (midCandidate === lastName) {
                    midCandidate = pickRandomWithJitter(familyNames, i + 1, attemptName + 2);
                }
                middleName = midCandidate;
                fullName = `${firstName} ${middleName} ${lastName}`;
                if (!usedFullNames.has(fullName)) break;
                attemptName += 1;
            }
            // reserve the full name
            usedFullNames.add(fullName || `${pickWithOffset(firstNames, globalIndex)} ${pickWithOffset(familyNames, i)} ${pickWithOffset(familyNames, globalIndex)}`);
            const uid = `${prefix}${pad(i + 1)}`;
            const email = `${role.charAt(0).toUpperCase() + role.slice(1)}${pad(i + 1)}@thesisflow.dev`;
            // special-case to ensure one-per-department assignment for moderator and head roles
            let department = pickDepartmentForRole(role, globalIndex + i);
            if (role === 'moderator') {
                // assign moderators so each maps to a department (round-robin), and they cover all courses
                department = departments[i % departments.length];
            }
            if (role === 'head') {
                // each head maps to a department (one per department)
                department = departments[i % departments.length];
            }
            const suffix = (globalIndex % 10 === 0 && role !== 'student') ? 'PhD' : '';
            const password = 'Password_123';

            // Ensure non-admins are never assigned Research Department
            if (department === 'Research Department' && role !== 'admin') {
                department = pickWithOffset(departments.filter(d => d !== 'Research Department'), globalIndex + i);
            }

            const userCourse = (role === 'moderator')
                ? (Array.isArray(coursesByDepartment[department]) ? coursesByDepartment[department].join(';') : '')
                : (role === 'student' ? pickCourseForDepartment(department, globalIndex + i) : '');

            const userRow = [
                uid,
                email,
                firstName,
                middleName,
                lastName,
                honorific,
                suffix,
                role,
                department,
                userCourse,
                `+1-555-${pad(1000 + globalIndex)}`,
                `https://storage.thesisflow.edu/avatars/${uid.toLowerCase()}.png`,
                `https://storage.thesisflow.edu/banners/${uid.toLowerCase()}.jpg`,
                `${firstName} ${lastName} focuses on ${pickWithOffset(thesisTopics, globalIndex)} research.`,
                password,
            ];

            users.push(userRow);
            userEmails.set(uid, email);
            usersByRole[role].push(uid);
            userDetails.set(uid, {
                role,
                department,
                course: role === 'student' ? userRow[9] : '',
            });
            globalIndex += 1;
        }
    }

    // Fill remaining slots with students if rounding left gaps
    while (users.length < totalUsers) {
        const i = users.length;
        const role = 'student';
        // Fill remaining students: ensure unique full names here too
        let attemptName = 0;
        let firstName = pickWithOffset(firstNames, i, 0);
        let lastName = pickWithOffset(familyNames, i * 2, 0);
        let middleName = pickRandomWithJitter(familyNames, i, attemptName);
        let fullName = `${firstName} ${middleName} ${lastName}`;
        while (usedFullNames.has(fullName) && attemptName < 100) {
            attemptName += 1;
            firstName = pickRandomWithJitter(firstNames, i + attemptName, 0);
            lastName = pickRandomWithJitter(familyNames, i * 2 + attemptName, 0);
            middleName = pickRandomWithJitter(familyNames, i + attemptName, attemptName);
            if (middleName === lastName) middleName = pickRandomWithJitter(familyNames, i + attemptName + 1, attemptName + 1);
            fullName = `${firstName} ${middleName} ${lastName}`;
        }
        usedFullNames.add(fullName);
        const uid = `${rolePrefixes.student}${pad(usersByRole.student.length + 1)}`;
        const email = `Student${pad(usersByRole.student.length + 1)}@thesisflow.dev`;
        const department = pickWithOffset(departments.filter(d => d !== 'Research Department' && d !== 'IT Department'), i + 2);
        const course = pickCourseForDepartment(department, usersByRole.student.length + attemptName);
        const userRow = [
            uid, email, firstName, middleName, lastName, '', '', role, department,
            course,
            `+1-555-${pad(1000 + i)}`, `https://storage.thesisflow.edu/avatars/${uid.toLowerCase()}.png`,
            `https://storage.thesisflow.edu/banners/${uid.toLowerCase()}.jpg`,
            `${firstName} ${lastName} focuses on ${pickWithOffset(thesisTopics, i)} research.`, 'Password_123',
        ];
        users.push(userRow);
        userEmails.set(uid, email);
        usersByRole.student.push(uid);
        userDetails.set(uid, {
            role,
            department,
            course,
        });
    }

    return { users, userEmails, usersByRole, userDetails, totalUsers, roleCounts: normalizedCounts };
};

const pickUniqueFromList = (source, count, seed) => {
    const result = [];
    let attempt = 0;
    while (result.length < count && attempt < source.length * 2) {
        const index = (seed + attempt * 7) % source.length;
        const candidate = source[index];
        if (!result.includes(candidate)) {
            result.push(candidate);
        }
        attempt += 1;
    }
    return result;
};

const generateGroups = (usersByRole, userDetails, ungroupedStudents = []) => {
    const groups = [];
    const baseDate = new Date('2025-01-01T08:00:00.000Z');
    const ungroupedSet = new Set(ungroupedStudents);

    // Students available for grouping (exclude those intentionally left ungrouped)
    const availableStudents = usersByRole.student.filter(uid => !ungroupedSet.has(uid));

    for (let i = 0; i < RECORD_COUNT; i += 1) {
        // Enforce: exactly one adviser and one editor per group, and up to 4 students per group.
        const studentCount = Math.min(4, 1 + (i % 4)); // yields 1..4 students
        const leaderPool = availableStudents.length > 0 ? availableStudents : usersByRole.student;
        if (leaderPool.length === 0) {
            break;
        }

        const leader = pickWithOffset(leaderPool, i);
        const leaderDetails = userDetails.get(leader) || {};
        const leaderDepartment = leaderDetails.department || pickWithOffset(departments, i);
        const leaderCourse = leaderDetails.course || pickCourseForDepartment(leaderDepartment, i);

        const memberCount = Math.max(studentCount - 1, 0);
        const eligibleMembers = leaderPool.filter(
            uid => uid !== leader && (!leaderCourse || userDetails.get(uid)?.course === leaderCourse)
        );
        let selectedMembers = pickUniqueFromList(eligibleMembers, memberCount, i * 3 + 5);

        if (selectedMembers.length < memberCount) {
            const fallbackPool = usersByRole.student.filter(
                uid => uid !== leader && !selectedMembers.includes(uid)
            );
            const additional = pickUniqueFromList(fallbackPool, memberCount - selectedMembers.length, i * 7 + 3);
            selectedMembers = selectedMembers.concat(additional);
        }

        const students = [leader, ...selectedMembers];

        // Ensure there is an adviser and editor for the group; fall back to admins if role lists are empty
        const adviser = (usersByRole.adviser && usersByRole.adviser.length > 0)
            ? pickWithOffset(usersByRole.adviser, i)
            : pickWithOffset(usersByRole.admin, i);

        const editor = (usersByRole.editor && usersByRole.editor.length > 0)
            ? pickWithOffset(usersByRole.editor, i * 2)
            : pickWithOffset(usersByRole.admin, i * 3);

        let panelSource = (usersByRole.panel && usersByRole.panel.length > 0) ? usersByRole.panel.slice() : [];
        if (panelSource.length === 0) {
            const fallbackPanelCandidates = Array.from(new Set([
                ...usersByRole.moderator,
                ...usersByRole.head,
                ...usersByRole.adviser,
                ...usersByRole.editor,
                ...usersByRole.admin,
            ].filter(Boolean)));
            panelSource = fallbackPanelCandidates.length > 0 ? fallbackPanelCandidates : [leader];
        }
        const panelTargetCount = Math.max(1, Math.min(3, panelSource.length));
        const panels = pickUniqueFromList(panelSource, panelTargetCount, i * 5 + 11);

        const statuses = ['active', 'completed', 'inactive', 'archived'];
        const status = pickWithOffset(statuses, i);
        const createdAt = buildIso(baseDate, i * 2, 9, 30);
        const updatedAt = buildIso(baseDate, i * 2 + 10, 14, 15);
        const groupDepartment = leaderDepartment || pickWithOffset(departments, i);
        const groupCourse = leaderCourse || pickCourseForDepartment(groupDepartment, i);

        groups.push([
            `GRP${pad(i + 1)}`,
            `Thesis Cohort ${pad(i + 1)}`,
            leader,
            students.join(';'),
            adviser,
            editor,
            panels.join(';'),
            `Team researching ${pickWithOffset(thesisTopics, i)} applications.`,
            status,
            createdAt,
            updatedAt,
            `${pickWithOffset(thesisTopics, i)} in Practice`,
            groupDepartment,
            groupCourse,
        ]);
    }

    return groups;
};

const generateSchedule = (usersByRole, calendarIds) => {
    const schedules = [];
    const baseDate = new Date('2025-02-01T08:00:00.000Z');
    const admins = usersByRole.admin;

    for (let i = 0; i < RECORD_COUNT; i += 1) {
        const students = pickUniqueFromList(usersByRole.student, 2 + (i % 3), i * 3 + 5);
        const adviser = pickWithOffset(usersByRole.adviser, i * 2);
        const editor = pickWithOffset(usersByRole.editor, i * 3);
        const organizerCandidates = [adviser, editor, pickWithOffset(admins, i)];
        const organizer = organizerCandidates[i % organizerCandidates.length];

        // Use available calendars; rotate through them
        const calendarId = calendarIds.length > 0 ? calendarIds[i % calendarIds.length] : 'default';

        const participantEntries = [];
        participantEntries.push({ uid: organizer, role: 'organizer', status: 'accepted' });
        students.forEach((uid, idx) => {
            participantEntries.push({
                uid,
                role: idx % 2 === 0 ? 'required' : 'optional',
                status: pickWithOffset(participantStatuses, i + idx),
            });
        });
        participantEntries.push({ uid: adviser, role: 'required', status: pickWithOffset(participantStatuses, i + 3) });
        participantEntries.push({ uid: editor, role: 'optional', status: pickWithOffset(participantStatuses, i + 4) });

        const startDate = buildIso(baseDate, i, 9 + (i % 6), (i % 2) * 30);
        const endDate = buildIso(baseDate, i, 10 + (i % 6), (i % 2) * 30);
        const locationMode = i % 3;

        const location = {
            address: locationMode !== 1 ? `${100 + i} Innovation Way` : '',
            room: locationMode !== 1 ? `Room ${200 + (i % 50)}` : '',
            url: locationMode !== 0 ? `https://meet.thesisflow.edu/session-${pad(i + 1)}` : '',
            platform: locationMode !== 0 ? (i % 2 === 0 ? 'Zoom' : 'Google Meet') : '',
        };

        schedules.push([
            `EVT${pad(i + 1)}`,
            `Milestone Session ${pad(i + 1)}`,
            `Working session focused on ${pickWithOffset(thesisTopics, i)} progress.`,
            calendarId,
            pickWithOffset(eventStatuses, i),
            startDate,
            endDate,
            locationMode === 2 ? 'true' : 'false',
            organizer,
            participantEntries.map(p => `${p.uid}:${p.role}:${p.status}`).join(';'),
            location.address,
            location.room,
            location.url,
            location.platform,
            `${pickWithOffset(eventTags, i)};${pickWithOffset(eventTags, i + 2)}`,
            pickWithOffset(eventColors, i),
            pickWithOffset(admins, i + 5),
            buildIso(baseDate, i - 5, 7, 45),
        ]);
    }

    return schedules;
};

const generateFiles = (usersByRole, userEmails) => {
    const files = [];
    const baseDate = new Date('2025-02-10T08:00:00.000Z');
    const allAuthors = usersByRole.student.concat(
        usersByRole.adviser,
        usersByRole.editor,
        usersByRole.panel,
        usersByRole.moderator,
        usersByRole.head,
        usersByRole.statistician
    );

    for (let i = 0; i < RECORD_COUNT; i += 1) {
        const fileMeta = pickWithOffset(fileTypes, i);
        const id = `FIL${pad(i + 1)}`;
        const authorUid = pickWithOffset(allAuthors, i * 3 + 4);
        const authorEmail = userEmails.get(authorUid) || `${authorUid.toLowerCase()}@thesisflow.dev`;
        const uploadDate = buildIso(baseDate, Math.floor(i / 2), 8 + (i % 6), (i % 4) * 15);
        const sizeBytes = (250 + (i % 25) * 25) * 1024;
        const isMedia = ['mp4', 'mp3'].includes(fileMeta.ext);

        files.push([
            id,
            `${pickWithOffset(thesisTopics, i)} Resource ${i + 1}.${fileMeta.ext}`,
            fileMeta.ext,
            String(sizeBytes),
            `https://storage.thesisflow.edu/files/${id.toLowerCase()}.${fileMeta.ext}`,
            fileMeta.mime,
            isMedia ? '' : `https://storage.thesisflow.edu/thumbnails/${id.toLowerCase()}.png`,
            isMedia ? `${3 + (i % 5)}:${String(15 + (i % 45)).padStart(2, '0')}` : '',
            uploadDate,
            authorEmail,
            fileMeta.category,
        ]);
    }

    return files;
};

const generateForms = (usersByRole, userEmails) => {
    const forms = [];
    const baseDate = new Date('2025-01-15T08:00:00.000Z');
    const authors = usersByRole.admin.concat(
        usersByRole.adviser,
        usersByRole.editor,
        usersByRole.panel,
        usersByRole.moderator,
        usersByRole.head,
        usersByRole.statistician
    );

    for (let i = 0; i < RECORD_COUNT; i += 1) {
        const audience = pickWithOffset(formAudiences, i);
        const status = pickWithOffset(formStatuses, i + 1);
        const createdAt = buildIso(baseDate, i, 9, 0);
        const updatedAt = buildIso(baseDate, i + Math.floor(i / 4), 15, 20);
        const authorUid = pickWithOffset(authors, i * 2 + 3);
        const authorEmail = userEmails.get(authorUid) || `${authorUid.toLowerCase()}@thesisflow.dev`;
        const dueInDays = 3 + (i % 14);

        const fields = [
            {
                id: `field_summary_${i + 1}`,
                fieldType: 'longText',
                label: 'Progress Summary',
                required: true,
                rows: 4 + (i % 3),
            },
            {
                id: `field_blockers_${i + 1}`,
                fieldType: 'longText',
                label: 'Blockers',
                required: false,
                helperText: 'List risks or challenges.',
            },
            {
                id: `field_next_${i + 1}`,
                fieldType: 'shortText',
                label: 'Next Milestone',
                required: true,
            },
        ];

        const workflow = [
            { order: 1, role: audience, label: `${audience.charAt(0).toUpperCase() + audience.slice(1)} Submission` },
            { order: 2, role: 'adviser', label: 'Adviser Review', requiresSignature: (i % 4) === 0 },
            { order: 3, role: 'editor', label: 'Editorial Approval', required: (i % 5) !== 0 },
        ];

        const availableGroups = [`GRP${pad((i % RECORD_COUNT) + 1)}`, `GRP${pad(((i + 7) % RECORD_COUNT) + 1)}`];

        forms.push([
            `FRM${pad(i + 1)}`,
            `Progress Update Template ${pad(i + 1)}`,
            `Weekly reporting form for ${pickWithOffset(thesisTopics, i)} cohort.`,
            `1.${i % 5}.${i % 10}`,
            audience,
            status,
            createdAt,
            updatedAt,
            authorEmail,
            `${pickWithOffset(eventTags, i)};${pickWithOffset(eventTags, i + 3)}`,
            `Ensure ${pickWithOffset(thesisTopics, i + 5).toLowerCase()} context is captured.`,
            String(dueInDays),
            JSON.stringify(fields),
            JSON.stringify(workflow),
            availableGroups.join(';'),
        ]);
    }

    return forms;
};

const generateCalendars = (usersByRole, groups) => {
    const calendars = [];
    const baseDate = new Date('2025-01-01T08:00:00.000Z');

    // Create personal calendars for all users
    Object.entries(usersByRole).forEach(([, uids]) => {
        uids.forEach((uid) => {
            calendars.push([
                `CAL_PERS_${uid}`,
                `${uid}'s Personal Calendar`,
                'Personal calendar for thesis work',
                'personal',
                '#1E88E5',
                JSON.stringify([{ uid, role: 'owner', canView: true, canEdit: true, canDelete: true }]),
                uid,
                uid,
                buildIso(baseDate, 0, 8, 0),
                buildIso(baseDate, 0, 8, 0),
                'true',
                'true',
            ]);
        });
    });

    // Create shared calendars for each group
    groups.forEach((groupRow, idx) => {
        const groupId = groupRow[0];
        const groupMembers = groupRow[3].split(';').filter(Boolean);
        const adviser = groupRow[4];
        const editor = groupRow[5];
        const panelMembers = (groupRow[6] || '').split(';').filter(Boolean);

        // Build permissions for group calendar
        const permissions = [
            { uid: groupRow[2], role: 'owner', canView: true, canEdit: true, canDelete: true }, // leader
            ...groupMembers.map(uid => ({ uid, role: 'member', canView: true, canEdit: true, canDelete: false })),
            { uid: adviser, role: 'adviser', canView: true, canEdit: true, canDelete: false },
            { uid: editor, role: 'editor', canView: true, canEdit: true, canDelete: false },
            ...panelMembers.map(uid => ({ uid, role: 'panel', canView: true, canEdit: false, canDelete: false })),
        ];

        calendars.push([
            `CAL_GRP_${groupId}`,
            `${groupRow[1]} - Shared Calendar`,
            `Shared calendar for ${groupRow[1]} thesis work`,
            'group',
            pickWithOffset(eventColors, idx),
            JSON.stringify(permissions),
            groupRow[2], // ownerUid (group leader)
            groupRow[2], // createdBy
            buildIso(baseDate, idx, 9, 0),
            buildIso(baseDate, idx, 9, 0),
            'true',
            'true',
            groupId,
            groupRow[1],
        ]);
    });

    return calendars;
};

const generateTheses = (groups, usersByRole, thesisTitles) => {
    const theses = [];
    const baseDate = new Date('2025-02-10T08:00:00.000Z');
    const advisers = usersByRole.adviser;
    const editors = usersByRole.editor;

    for (let i = 0; i < RECORD_COUNT; i += 1) {
        const groupRow = groups[i];
        const title = thesisTitles && thesisTitles[i] ? thesisTitles[i] : `${pickWithOffset(thesisTopics, i)} Implementation ${pad(i + 1)}`;
        const leader = groupRow[2];
        const members = groupRow[3].split(';');
        const adviser = groupRow[4] || pickWithOffset(advisers, i);
        const editor = groupRow[5] || pickWithOffset(editors, i);
        const submissionDate = buildIso(baseDate, i, 14, 0);
        const lastUpdated = buildIso(baseDate, i + 3, 16, 30);
        const status = pickWithOffset(thesisStatuses, i);

        const chapters = Array.from({ length: 3 }, (_, chapterIdx) => (
            {
                id: chapterIdx + 1,
                title: `Chapter ${chapterIdx + 1}: ${pickWithOffset(thesisTopics, i + chapterIdx)}`,
                status: pickWithOffset(['under_review', 'revision_required', 'approved', 'not_submitted'], i + chapterIdx),
                submissionDate: buildIso(baseDate, i + chapterIdx, 10, 15),
                lastModified: buildIso(baseDate, i + chapterIdx + 1, 12, 45),
                submissions: [`FIL${pad(((i * 3) + chapterIdx + 1) % RECORD_COUNT + 1)}`],
                comments: [
                    {
                        author: chapterIdx % 2 === 0 ? adviser : editor,
                        date: buildIso(baseDate, i + chapterIdx + 1, 13, 30),
                        comment: `Feedback on ${pickWithOffset(thesisTopics, i + chapterIdx).toLowerCase()} focus area.`,
                        attachments: [],
                        version: chapterIdx + 1,
                    },
                ],
            }
        ));

        theses.push([
            title,
            leader,
            members.join(';'),
            adviser,
            editor,
            submissionDate,
            lastUpdated,
            status,
            JSON.stringify(chapters),
        ]);
    }

    return theses;
};

const generateTopicProposals = (groups, usersByRole) => {
    const baseDate = new Date('2025-01-05T09:00:00.000Z');
    const moderatorPool = (usersByRole.moderator && usersByRole.moderator.length > 0)
        ? usersByRole.moderator
        : ((usersByRole.adviser && usersByRole.adviser.length > 0) ? usersByRole.adviser : usersByRole.admin);
    const headPool = (usersByRole.head && usersByRole.head.length > 0)
        ? usersByRole.head
        : ((usersByRole.admin && usersByRole.admin.length > 0)
            ? usersByRole.admin
            : (usersByRole.editor && usersByRole.editor.length > 0 ? usersByRole.editor : moderatorPool));

    return groups.map((groupRow, idx) => {
        const groupId = groupRow[0];
        const groupName = groupRow[1];
        const leader = groupRow[2];
        const memberList = (groupRow[3] || '')
            .split(';')
            .map(uid => uid.trim())
            .filter(Boolean);
        const department = groupRow[12] || pickWithOffset(departments, idx);
        const cycle = (idx % 4) + 1;
        const entryCount = idx % 5 === 0 ? 0 : Math.min(MAX_TOPIC_PROPOSALS, (idx % MAX_TOPIC_PROPOSALS) + 1);
        const reviewHistory = [];
        const entries = [];

        for (let entryIdx = 0; entryIdx < entryCount; entryIdx += 1) {
            const proposalId = `${groupId}_TP${entryIdx + 1}`;
            const status = topicProposalEntryStatuses[(idx + entryIdx) % topicProposalEntryStatuses.length];
            const proposerPool = memberList.length > 0 ? memberList : [leader];
            const proposedBy = pickWithOffset(proposerPool, idx + entryIdx);
            const createdAt = buildIso(baseDate, idx + entryIdx, 9 + (entryIdx % 3), (entryIdx % 2) * 15);
            const updatedAt = buildIso(baseDate, idx + entryIdx + 1, 14, (entryIdx % 2) * 20);
            const keywords = [department, pickWithOffset(thesisTopics, idx + entryIdx)]
                .filter(Boolean)
                .map((word, wordIdx, arr) => arr.indexOf(word) === wordIdx ? word : null)
                .filter(Boolean);

            const entry = {
                id: proposalId,
                title: `${groupName} Topic ${entryIdx + 1}`,
                abstract: `Explores ${pickWithOffset(thesisTopics, idx + entryIdx)} applications for ${department}.`,
                problemStatement: `Addresses challenges faced by ${department} teams in adopting ${pickWithOffset(thesisTopics, idx + entryIdx + 5)}.`,
                expectedOutcome: `Deliver a validated framework leveraging ${pickWithOffset(thesisTopics, idx + entryIdx + 9)}.`,
                keywords,
                proposedBy,
                createdAt,
                updatedAt,
                status,
            };

            if (['head_review', 'head_approved', 'head_rejected', 'moderator_rejected'].includes(status)) {
                const moderatorSource = (moderatorPool && moderatorPool.length > 0) ? moderatorPool : usersByRole.admin;
                const moderatorUid = pickWithOffset(moderatorSource.length > 0 ? moderatorSource : [leader], idx + entryIdx);
                const moderatorDecision = {
                    reviewerUid: moderatorUid,
                    decision: status === 'moderator_rejected' ? 'rejected' : 'approved',
                    decidedAt: buildIso(baseDate, idx + entryIdx + 1, 10, 0),
                    notes: `Moderator review for ${proposalId}`,
                };
                entry.moderatorDecision = moderatorDecision;
                reviewHistory.push({
                    stage: 'moderator',
                    decision: moderatorDecision.decision,
                    reviewerUid: moderatorUid,
                    proposalId,
                    notes: moderatorDecision.notes,
                    reviewedAt: moderatorDecision.decidedAt,
                });
            }

            if (status === 'head_approved' || status === 'head_rejected') {
                const headSource = (headPool && headPool.length > 0) ? headPool : moderatorPool;
                const reviewerPool = (headSource && headSource.length > 0) ? headSource : [leader];
                const headUid = pickWithOffset(reviewerPool, idx + entryIdx * 2);
                const headDecision = {
                    reviewerUid: headUid,
                    decision: status === 'head_approved' ? 'approved' : 'rejected',
                    decidedAt: buildIso(baseDate, idx + entryIdx + 2, 11, 30),
                    notes: `Head decision for ${proposalId}`,
                };
                entry.headDecision = headDecision;
                reviewHistory.push({
                    stage: 'head',
                    decision: headDecision.decision,
                    reviewerUid: headUid,
                    proposalId,
                    notes: headDecision.notes,
                    reviewedAt: headDecision.decidedAt,
                });
            }

            entries.push(entry);
        }

        const awaitingModerator = entries.some(entry => entry.status === 'submitted');
        const awaitingHead = entries.some(entry => entry.status === 'head_review');
        const approvedEntry = entries.find(entry => entry.status === 'head_approved');
        const rejectedOnly = entries.length > 0 && entries.every(entry => (
            entry.status === 'moderator_rejected' || entry.status === 'head_rejected'
        ));
        const nonDraft = entries.find(entry => entry.status !== 'draft');

        let setStatus = 'draft';
        if (approvedEntry) {
            setStatus = 'approved';
        } else if (awaitingModerator || awaitingHead) {
            setStatus = 'under_review';
        } else if (rejectedOnly) {
            setStatus = 'rejected';
        }

        // previously set lockedEntryId from entries — removed when flattening header columns

        return [
            `TPS${pad(idx + 1)}`,
            groupId,
            leader,
            buildIso(baseDate, idx, 8, 0),
            buildIso(baseDate, idx + entryCount + 1, 16, 0),
            setStatus,
            String(cycle),
            awaitingModerator ? 'true' : 'false',
            awaitingHead ? 'true' : 'false',
            nonDraft?.proposedBy || '',
            nonDraft?.createdAt || '',
            // approvedEntryId and lockedEntryId removed — we no longer include those columns
            approvedEntry ? leader : '',
            approvedEntry ? buildIso(baseDate, idx + 20, 12, 30) : '',
            JSON.stringify(entries),
            JSON.stringify(reviewHistory),
        ];
    });
};
// Interactive prompt to let the user override counts at runtime.
const parseArg = (key) => {
    // Use globalThis to avoid linter warnings about `process` being undefined in some configs.
    const proc = typeof globalThis !== 'undefined' ? globalThis.process : undefined;
    if (!proc || !Array.isArray(proc.argv)) return null;
    const match = proc.argv.find(a => a.startsWith(`--${key}=`));
    if (match) return match.split('=')[1];
    return null;
};

const promptInputs = async () => {
    // Support command-line overrides: --users=200 --admins=15 --advisers=20 --editors=12 --panels=10 --statisticians=2 --developers=2 --students=60
    // plus --groups=50 --ungrouped=10 --schedules=80 --files=100 --forms=50 --theses=50 --calendars=10
    const usersArg = parseArg('users');
    const groupsArg = parseArg('groups');
    const ungroupedArg = parseArg('ungrouped');
    const schedulesArg = parseArg('schedules');
    const filesArg = parseArg('files');
    const formsArg = parseArg('forms');
    const thesesArg = parseArg('theses');
    const calendarsArg = parseArg('calendars');

    const cliRoleCounts = { ...defaultRoleCounts };
    let hasRoleArg = false;
    // skip moderator/head: they are enforced per-department and not accepted via CLI args
    ROLE_KEYS.forEach((role) => {
        if (role === 'moderator' || role === 'head') return;
        const argKey = roleArgMap[role];
        const argValue = parseArg(argKey);
        if (argValue !== null) {
            hasRoleArg = true;
            cliRoleCounts[role] = parseCountOrFallback(argValue, cliRoleCounts[role]);
        }
    });

    if (usersArg !== null || groupsArg !== null || ungroupedArg !== null || schedulesArg !== null ||
        filesArg !== null || formsArg !== null || thesesArg !== null || calendarsArg !== null || hasRoleArg) {
        // Enforce exact one moderator/head per department regardless of CLI input
        const enforcedCounts = { ...defaultRoleCounts };
        if (hasRoleArg) Object.assign(enforcedCounts, cliRoleCounts);
        else if (usersArg !== null) Object.assign(enforcedCounts, scaleRoleCounts(parseCountOrFallback(usersArg, sumRoleCounts(defaultRoleCounts))));
        const roleCounts = enforcedCounts;
        roleCounts.moderator = departments.length;
        roleCounts.head = departments.length;

        const groupsToCreate = parseCountOrFallback(groupsArg, 100);
        const ungroupedCount = ungroupedArg == null ? null : parseCountOrFallback(ungroupedArg, 0);
        const schedulesToCreate = parseCountOrFallback(schedulesArg, 100);
        const filesToCreate = parseCountOrFallback(filesArg, 100);
        const formsToCreate = parseCountOrFallback(formsArg, 100);
        const thesesCount = parseCountOrFallback(thesesArg, 100);
        const calendarsToCreate = parseCountOrFallback(calendarsArg, 10);

        return {
            roleCounts,
            totalUsers: sumRoleCounts(roleCounts),
            groupsToCreate,
            ungroupedCount,
            schedulesToCreate,
            filesToCreate,
            formsToCreate,
            thesesCount,
            calendarsToCreate,
        };
    }

    const rl = createInterface({ input: stdin, output: stdout });
    try {
        // Interactive prompts: do not ask for moderators or heads — we enforce one-per-department
        const roleCounts = { ...defaultRoleCounts };
        for (const role of ROLE_KEYS) {
            if (role === 'moderator' || role === 'head') continue;
            const promptLabel = rolePromptLabels[role];
            const answer = await rl.question(`How many ${promptLabel} should be created? (default ${roleCounts[role]}): `);
            roleCounts[role] = parseCountOrFallback(answer.trim(), roleCounts[role]);
        }
        // Ensure one moderator and one head per department
        roleCounts.moderator = departments.length;
        roleCounts.head = departments.length;

        const groupsAnswer = await rl.question(`How many groups should be created? (default 100): `);
        const ungroupedAnswer = await rl.question(`How many students should remain ungrouped? (leave empty for ~10% default): `);
        const schedulesAnswer = await rl.question(`How many schedules/events should be created? (default 100): `);
        const filesAnswer = await rl.question(`How many files should be created? (default 100): `);
        const formsAnswer = await rl.question(`How many forms should be created? (default 100): `);
        const thesesAnswer = await rl.question(`How many theses should be created? (default 100): `);
        const calendarsAnswer = await rl.question(`How many extra shared calendars should be created? (default 10): `);

        const groupsToCreate = parseCountOrFallback(groupsAnswer, 100);
        const ungroupedCount = (ungroupedAnswer || '').trim() === '' ? null : parseCountOrFallback(ungroupedAnswer, 0);
        const schedulesToCreate = parseCountOrFallback(schedulesAnswer, 100);
        const filesToCreate = parseCountOrFallback(filesAnswer, 100);
        const formsToCreate = parseCountOrFallback(formsAnswer, 100);
        const thesesCount = parseCountOrFallback(thesesAnswer, 100);
        const calendarsToCreate = parseCountOrFallback(calendarsAnswer, 10);

        return {
            roleCounts,
            totalUsers: sumRoleCounts(roleCounts),
            groupsToCreate,
            ungroupedCount,
            schedulesToCreate,
            filesToCreate,
            formsToCreate,
            thesesCount,
            calendarsToCreate,
        };
    } finally {
        rl.close();
    }
};

const main = async () => {
    if (!existsSync(baseDir)) {
        // Create the output directory if it does not exist to make the script more user-friendly.
        // This avoids failing when the mock/csv directory hasn't been created yet.
        // Create directory synchronously (acceptable for a small CLI utility)
        mkdirSync(baseDir, { recursive: true });
        log(`Created missing CSV directory: ${baseDir}`);
    }

    const {
        roleCounts,
        groupsToCreate,
        ungroupedCount,
        schedulesToCreate,
        filesToCreate,
        formsToCreate,
        thesesCount,
        calendarsToCreate,
    } = await promptInputs();

    const {
        users,
        userEmails,
        usersByRole,
        userDetails,
        totalUsers: generatedTotalUsers,
        roleCounts: resolvedRoleCounts,
    } = generateUsers(roleCounts);
    writeCsv('users.mock.csv', [
        'uid', 'email', 'firstName', 'middleName', 'lastName', 'prefix', 'suffix', 'role', 'department', 'course',
        'phone', 'avatar', 'banner', 'bio', 'password',
    ], users);

    // Generate groups
    RECORD_COUNT = groupsToCreate;
    const defaultUngrouped = Math.max(1, Math.floor(usersByRole.student.length * 0.1));
    const resolvedUngroupedCount = (typeof ungroupedCount === 'number' && ungroupedCount !== null)
        ? Math.min(ungroupedCount, usersByRole.student.length)
        : defaultUngrouped;
    const ungroupedStudents = sample(usersByRole.student, resolvedUngroupedCount);

    const thesisTitles = generateUniqueThesisTitles(groupsToCreate);

    const groups = generateGroups(usersByRole, userDetails, ungroupedStudents);
    writeCsv('groups.mock.csv', [
        'id', 'name', 'leader', 'members', 'adviser', 'editor', 'panels', 'description', 'status', 'createdAt',
        'updatedAt', 'thesisTitle', 'department', 'course',
    ], groups);

    // Generate calendars (personal for all users + group calendars)
    const calendars = generateCalendars(usersByRole, groups);
    writeCsv('calendars.mock.csv', [
        'id', 'name', 'description', 'type', 'color', 'permissions', 'ownerUid', 'createdBy', 'createdAt',
        'lastModified', 'isVisible', 'isDefault', 'groupId', 'groupName',
    ], calendars);

    // Add extra shared calendars (not tied to groups/personal) if requested
    if (typeof calendarsToCreate === 'number' && calendarsToCreate > 0) {
        const extraBase = new Date('2025-01-15T08:00:00.000Z');
        const adminOwner = (usersByRole.admin && usersByRole.admin.length > 0) ? usersByRole.admin[0] : (users.length > 0 ? users[0][0] : 'SYS');
        for (let i = 0; i < calendarsToCreate; i += 1) {
            const id = `CAL_EXTRA_${pad(i + 1)}`;
            calendars.push([
                id,
                `Shared Calendar ${i + 1}`,
                `Shared calendar ${i + 1} for other schedules`,
                'shared',
                pickWithOffset(eventColors, i),
                JSON.stringify([{ uid: adminOwner, role: 'owner', canView: true, canEdit: true, canDelete: true }]),
                adminOwner,
                adminOwner,
                buildIso(extraBase, i, 9, 0),
                buildIso(extraBase, i, 9, 0),
                'true',
                'false',
                '',
                '',
            ]);
        }
    }

    // Extract calendar IDs for scheduling (use group calendars for schedule events)
    // Note: calendar `type` is at index 3 in the pushed arrays (0=id,1=name,2=description,3=type,...)
    const groupCalendarIds = calendars.filter(cal => cal[3] === 'group').map(cal => cal[0]);
    const availableCalendarIds = groupCalendarIds.length > 0 ? groupCalendarIds : calendars.map(cal => cal[0]);

    // Provide more accurate calendar counts for the summary
    const totalCalendars = calendars.length;
    const personalCalendarCount = calendars.filter(cal => cal[3] === 'personal').length;
    const groupCalendarCount = calendars.filter(cal => cal[3] === 'group').length;
    const extraCalendarCount = calendars.filter(cal => cal[3] === 'shared').length;

    // Generate schedules using calendars
    RECORD_COUNT = schedulesToCreate;
    const schedule = generateSchedule(usersByRole, availableCalendarIds);
    writeCsv('schedule.mock.csv', [
        'id', 'title', 'description', 'calendarId', 'status', 'startDate', 'endDate', 'isAllDay', 'organizer',
        'participants', 'location_address', 'location_room', 'location_url', 'location_platform', 'tags', 'color',
        'createdBy', 'createdAt',
    ], schedule);

    // Generate files
    RECORD_COUNT = filesToCreate;
    const files = generateFiles(usersByRole, userEmails);
    writeCsv('files.mock.csv', [
        'id', 'name', 'type', 'size', 'url', 'mimeType', 'thumbnail', 'duration', 'uploadDate', 'author', 'category',
    ], files);

    // Generate forms
    RECORD_COUNT = formsToCreate;
    const forms = generateForms(usersByRole, userEmails);
    writeCsv('forms.mock.csv', [
        'id', 'title', 'description', 'version', 'audience', 'status', 'createdAt', 'updatedAt', 'createdBy', 'tags',
        'reviewerNotes', 'dueInDays', 'fields', 'workflow', 'availableToGroups',
    ], forms);

    // Generate topic proposal sets based on group distribution
    const topicProposals = generateTopicProposals(groups, usersByRole);
    writeCsv('topicProposals.mock.csv', [
        'id', 'groupId', 'createdBy', 'createdAt', 'updatedAt', 'status', 'cycle', 'awaitingModerator', 'awaitingHead',
        'submittedBy', 'submittedAt', 'usedBy', 'usedAsThesisAt', 'entries', 'reviewHistory',
    ], topicProposals);

    // Generate theses
    RECORD_COUNT = thesesCount;
    const thesisGroupsSlice = groups.slice(0, thesesCount);
    const thesisTitlesSlice = thesisTitles.slice(0, thesesCount);
    const theses = generateTheses(thesisGroupsSlice, usersByRole, thesisTitlesSlice);
    writeCsv('theses.mock.csv', [
        'title', 'leader', 'members', 'adviser', 'editor', 'submissionDate', 'lastUpdated', 'overallStatus', 'chapters',
    ], theses);

    const roleSummary = ROLE_KEYS
        .map(role => `${role}=${resolvedRoleCounts[role] || 0}`)
        .join(', ');
    log('Mock CSV generation complete.');
    log(`Summary: Users=${generatedTotalUsers} (${roleSummary}), Groups=${groupsToCreate}, `
        + `Calendars=${totalCalendars} (personal=${personalCalendarCount}, group=${groupCalendarCount}, shared=${extraCalendarCount}), `
        + `Schedules=${schedule.length}, Files=${files.length}, Forms=${forms.length}, TopicProposals=${topicProposals.length}, Theses=${theses.length}`);
};

main();
