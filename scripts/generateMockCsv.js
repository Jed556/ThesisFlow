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
];
const middleInitials = ['', 'A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'J.'];
const lastNames = [
    'Anderson', 'Brooks', 'Campbell', 'Dawson', 'Ellis', 'Fletcher', 'Garcia', 'Hayes', 'Ibrahim', 'Jensen',
    'Kendall', 'Lopez', 'Monroe', 'Nguyen', 'Owens', 'Patel', 'Quincy', 'Ramirez', 'Singh', 'Turner',
];
const departments = [
    'Engineering', 'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Humanities', 'Business',
    'Design', 'Education', 'Public Policy', 'Health Sciences', 'Environmental Studies', 'Data Science', 'Robotics',
];
const thesisTopics = [
    'Autonomous Systems', 'Renewable Energy Forecasting', 'Digital Preservation', 'Smart Agriculture',
    'Medical Imaging AI', 'Cybersecurity Analytics', 'Human-Computer Interaction', 'Sustainable Materials',
    'Financial Risk Modeling', 'Neural Language Processing', 'Urban Mobility Optimization', 'Climate Impact Modeling',
    'Edge Computing', 'Quantum Communication', 'Assistive Robotics', 'Biometric Security', 'XR Learning Environments',
    'Cultural Heritage Digitization', 'Precision Medicine', 'Clean Water Solutions',
];
const calendarIds = ['thesis-events', 'adviser-sync', 'review-deadlines', 'student-workshops'];
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

const roleDistribution = [
    { role: 'admin', prefix: 'ADM', count: 8, honorific: 'Dr.' },
    { role: 'developer', prefix: 'DEV', count: 7, honorific: '' },
    { role: 'adviser', prefix: 'ADV', count: 20, honorific: 'Prof.' },
    { role: 'editor', prefix: 'EDT', count: 15, honorific: '' },
    { role: 'student', prefix: 'STD', count: 50, honorific: '' },
];

const pickWithOffset = (source, index, offset = 0) => source[(index + offset) % source.length];

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
 * Generate users using a scaled role distribution based on `totalUsers`.
 * roleDistribution count fields are treated as weights (they sum to ~100 in default)
 */
const generateUsers = (totalUsers = 100) => {
    const users = [];
    const userEmails = new Map();
    const usersByRole = {
        admin: [],
        adviser: [],
        editor: [],
        developer: [],
        student: [],
    };
    // Compute weight totals and scale counts to match the requested totalUsers
    const totalWeight = roleDistribution.reduce((s, r) => s + r.count, 0);
    const scaled = roleDistribution.map(r => ({ ...r, scaledCount: Math.max(1, Math.round((r.count / totalWeight) * totalUsers)) }));

    // Adjust rounding drift so total equals totalUsers
    let scaledSum = scaled.reduce((s, r) => s + r.scaledCount, 0);
    // Prefer to adjust the student count to absorb rounding differences
    const studentIdx = scaled.findIndex(r => r.role === 'student');
    if (studentIdx !== -1) {
        scaled[studentIdx].scaledCount += (totalUsers - scaledSum);
        scaledSum = scaled.reduce((s, r) => s + r.scaledCount, 0);
    }

    let globalIndex = 0;
    scaled.forEach(({ role, prefix, scaledCount, honorific }) => {
        for (let i = 0; i < scaledCount; i += 1) {
            const firstName = pickWithOffset(firstNames, globalIndex, i);
            const middleName = pickWithOffset(middleInitials, i);
            const lastName = pickWithOffset(lastNames, globalIndex, i * 2);
            const uid = `${prefix}${pad(i + 1)}`;
            const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
            const emailPrefix = `${roleLabel}${pad(i + 1)}`;
            const email = `${emailPrefix}@thesisflow.dev`;
            const department = pickWithOffset(departments, globalIndex + i);
            const suffix = (globalIndex % 10 === 0 && role !== 'student') ? 'PhD' : '';
            const password = 'Password_123';

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
                `+1-555-${pad(1000 + globalIndex)}`,
                `https://storage.thesisflow.edu/avatars/${uid.toLowerCase()}.png`,
                `https://storage.thesisflow.edu/banners/${uid.toLowerCase()}.jpg`,
                `${firstName} ${lastName} focuses on ${pickWithOffset(thesisTopics, globalIndex)} research.`,
                password,
            ];

            users.push(userRow);
            userEmails.set(uid, email);
            usersByRole[role].push(uid);
            globalIndex += 1;
        }
    });

    return { users, userEmails, usersByRole };
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

const generateGroups = (usersByRole, ungroupedStudents = []) => {
    const groups = [];
    const baseDate = new Date('2025-01-01T08:00:00.000Z');
    const ungroupedSet = new Set(ungroupedStudents);
    // Students available for grouping (exclude those intentionally left ungrouped)
    const availableStudents = usersByRole.student.filter(uid => !ungroupedSet.has(uid));
    for (let i = 0; i < RECORD_COUNT; i += 1) {
        const membersCount = 3 + ((i % 3));
        const membersSource = availableStudents.length >= membersCount ? availableStudents : usersByRole.student;
        const members = pickUniqueFromList(membersSource, membersCount, i);
        const leader = members[0] || pickWithOffset(usersByRole.student, i);
        const adviser = pickWithOffset(usersByRole.adviser, i);
        const editor = pickWithOffset(usersByRole.editor, i * 2);
        const statuses = ['active', 'completed', 'inactive', 'archived'];
        const status = pickWithOffset(statuses, i);
        const createdAt = buildIso(baseDate, i * 2, 9, 30);
        const updatedAt = buildIso(baseDate, i * 2 + 10, 14, 15);

        groups.push([
            `GRP${pad(i + 1)}`,
            `Thesis Cohort ${pad(i + 1)}`,
            leader,
            members.join(';'),
            adviser,
            editor,
            `Team researching ${pickWithOffset(thesisTopics, i)} applications.`,
            status,
            createdAt,
            updatedAt,
            `${pickWithOffset(thesisTopics, i)} in Practice`,
            pickWithOffset(departments, i),
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
    const allAuthors = usersByRole.student.concat(usersByRole.adviser, usersByRole.editor);

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
    const authors = usersByRole.admin.concat(usersByRole.adviser, usersByRole.editor);

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
    Object.entries(usersByRole).forEach(([role, uids]) => {
        uids.forEach((uid, idx) => {
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

        // Build permissions for group calendar
        const permissions = [
            { uid: groupRow[2], role: 'owner', canView: true, canEdit: true, canDelete: true }, // leader
            ...groupMembers.map(uid => ({ uid, role: 'member', canView: true, canEdit: true, canDelete: false })),
            { uid: adviser, role: 'adviser', canView: true, canEdit: true, canDelete: false },
            { uid: editor, role: 'editor', canView: true, canEdit: true, canDelete: false },
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
// Interactive prompt to let the user override counts at runtime.
const parseArg = (key) => {
    const match = process.argv.find(a => a.startsWith(`--${key}=`));
    if (match) {
        return match.split('=')[1];
    }
    return null;
};

const promptInputs = async () => {
    // Support command-line overrides: --users=200 --groups=50 --ungrouped=10 --schedules=80 --files=100 --forms=50 --theses=50 --calendars=100
    const usersArg = parseArg('users');
    const groupsArg = parseArg('groups');
    const ungroupedArg = parseArg('ungrouped');
    const schedulesArg = parseArg('schedules');
    const filesArg = parseArg('files');
    const formsArg = parseArg('forms');
    const thesesArg = parseArg('theses');
    const calendarsArg = parseArg('calendars');

    if (usersArg !== null || groupsArg !== null || ungroupedArg !== null || schedulesArg !== null ||
        filesArg !== null || formsArg !== null || thesesArg !== null || calendarsArg !== null) {
        const usersToCreate = Number.parseInt(usersArg || '100', 10) || 100;
        const groupsToCreate = Number.parseInt(groupsArg || '100', 10) || 100;
        const ungroupedCount = ungroupedArg == null ? null : (Number.parseInt(ungroupedArg, 10) || 0);
        const schedulesToCreate = Number.parseInt(schedulesArg || '100', 10) || 100;
        const filesToCreate = Number.parseInt(filesArg || '100', 10) || 100;
        const formsToCreate = Number.parseInt(formsArg || '100', 10) || 100;
        const thesesCount = Number.parseInt(thesesArg || '100', 10) || 100;
        const calendarsToCreate = Number.parseInt(calendarsArg || '100', 10) || 100;
        return { usersToCreate, groupsToCreate, ungroupedCount, schedulesToCreate, filesToCreate, formsToCreate, thesesCount, calendarsToCreate };
    }

    const rl = createInterface({ input: stdin, output: stdout });
    try {
        const usersAnswer = await rl.question(`How many total users should be created? (default 100): `);
        const groupsAnswer = await rl.question(`How many groups should be created? (default 100): `);
        const ungroupedAnswer = await rl.question(`How many users should remain ungrouped? (leave empty for ~10% default): `);
        const schedulesAnswer = await rl.question(`How many schedules/events should be created? (default 100): `);
        const filesAnswer = await rl.question(`How many files should be created? (default 100): `);
        const formsAnswer = await rl.question(`How many forms should be created? (default 100): `);
        const thesesAnswer = await rl.question(`How many theses should be created? (default 100): `);
        const calendarsAnswer = await rl.question(`How many calendars should be created? (default 100): `);

        const usersToCreate = Number.parseInt(usersAnswer || '100', 10) || 100;
        const groupsToCreate = Number.parseInt(groupsAnswer || '100', 10) || 100;
        const ungroupedCount = ungroupedAnswer === '' ? null : (Number.parseInt(ungroupedAnswer, 10) || 0);
        const schedulesToCreate = Number.parseInt(schedulesAnswer || '100', 10) || 100;
        const filesToCreate = Number.parseInt(filesAnswer || '100', 10) || 100;
        const formsToCreate = Number.parseInt(formsAnswer || '100', 10) || 100;
        const thesesCount = Number.parseInt(thesesAnswer || '100', 10) || 100;
        const calendarsToCreate = Number.parseInt(calendarsAnswer || '100', 10) || 100;

        return { usersToCreate, groupsToCreate, ungroupedCount, schedulesToCreate, filesToCreate, formsToCreate, thesesCount, calendarsToCreate };
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
        usersToCreate, groupsToCreate, ungroupedCount, schedulesToCreate, filesToCreate,
        formsToCreate, thesesCount, calendarsToCreate,
    } = await promptInputs();

    const { users, userEmails, usersByRole } = generateUsers(usersToCreate);
    writeCsv('users.mock.csv', [
        'uid', 'email', 'firstName', 'middleName', 'lastName', 'prefix', 'suffix', 'role', 'department',
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

    const groups = generateGroups(usersByRole, ungroupedStudents);
    writeCsv('groups.mock.csv', [
        'id', 'name', 'leader', 'members', 'adviser', 'editor', 'description', 'status', 'createdAt',
        'updatedAt', 'thesisTitle', 'department',
    ], groups);

    // Generate calendars (personal for all users + group calendars)
    const calendars = generateCalendars(usersByRole, groups);
    writeCsv('calendars.mock.csv', [
        'id', 'name', 'description', 'type', 'color', 'permissions', 'ownerUid', 'createdBy', 'createdAt',
        'lastModified', 'isVisible', 'isDefault', 'groupId', 'groupName',
    ], calendars);

    // Extract calendar IDs for scheduling (use group calendars for schedule events)
    const groupCalendarIds = calendars.filter(cal => cal[2] === 'group').map(cal => cal[0]);
    const availableCalendarIds = groupCalendarIds.length > 0 ? groupCalendarIds : calendars.map(cal => cal[0]);

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

    // Generate theses
    RECORD_COUNT = thesesCount;
    const thesisGroupsSlice = groups.slice(0, thesesCount);
    const thesisTitlesSlice = thesisTitles.slice(0, thesesCount);
    const theses = generateTheses(thesisGroupsSlice, usersByRole, thesisTitlesSlice);
    writeCsv('theses.mock.csv', [
        'title', 'leader', 'members', 'adviser', 'editor', 'submissionDate', 'lastUpdated', 'overallStatus', 'chapters',
    ], theses);

    log('Mock CSV generation complete.');
    log(`Summary: Users=${usersToCreate}, Groups=${groupsToCreate}, Calendars=${calendars.length}, `
        + `Schedules=${schedule.length}, Files=${files.length}, Forms=${forms.length}, Theses=${theses.length}`);
};

main();
