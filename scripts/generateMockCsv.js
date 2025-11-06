/* eslint-env node */
/**
 * Utility script to generate expanded mock CSV datasets for ThesisFlow.
 * The script produces 100 representative rows for each CSV handler.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { log } from 'node:console';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RECORD_COUNT = 100;
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

const generateUsers = () => {
    const users = [];
    const userEmails = new Map();
    const usersByRole = {
        admin: [],
        adviser: [],
        editor: [],
        developer: [],
        student: [],
    };

    let globalIndex = 0;
    roleDistribution.forEach(({ role, prefix, count, honorific }) => {
        for (let i = 0; i < count; i += 1) {
            const firstName = pickWithOffset(firstNames, globalIndex, i);
            const middleName = pickWithOffset(middleInitials, i);
            const lastName = pickWithOffset(lastNames, globalIndex, i * 2);
            const uid = `${prefix}${pad(i + 1)}`;
            const email = `${firstName}.${lastName}${globalIndex + 1}@example.edu`.toLowerCase();
            const department = pickWithOffset(departments, globalIndex + i);
            const suffix = (globalIndex % 10 === 0 && role !== 'student') ? 'PhD' : '';
            const password = `${role.charAt(0).toUpperCase() + role.slice(1)}@${100 + globalIndex}`;

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

const generateGroups = (usersByRole) => {
    const groups = [];
    const baseDate = new Date('2025-01-01T08:00:00.000Z');
    for (let i = 0; i < RECORD_COUNT; i += 1) {
        const membersCount = 3 + ((i % 3));
        const members = pickUniqueFromList(usersByRole.student, membersCount, i);
        const leader = members[0];
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

const generateSchedule = (usersByRole) => {
    const schedules = [];
    const baseDate = new Date('2025-02-01T08:00:00.000Z');
    const admins = usersByRole.admin;

    for (let i = 0; i < RECORD_COUNT; i += 1) {
        const students = pickUniqueFromList(usersByRole.student, 2 + (i % 3), i * 3 + 5);
        const adviser = pickWithOffset(usersByRole.adviser, i * 2);
        const editor = pickWithOffset(usersByRole.editor, i * 3);
        const organizerCandidates = [adviser, editor, pickWithOffset(admins, i)];
        const organizer = organizerCandidates[i % organizerCandidates.length];

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
            pickWithOffset(calendarIds, i),
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
        const authorEmail = userEmails.get(authorUid) || `${authorUid.toLowerCase()}@example.edu`;
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
        const authorEmail = userEmails.get(authorUid) || `${authorUid.toLowerCase()}@example.edu`;
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

const generateTheses = (groups, usersByRole) => {
    const theses = [];
    const baseDate = new Date('2025-02-10T08:00:00.000Z');
    const advisers = usersByRole.adviser;
    const editors = usersByRole.editor;

    for (let i = 0; i < RECORD_COUNT; i += 1) {
        const groupRow = groups[i];
        const title = `${pickWithOffset(thesisTopics, i)} Implementation ${pad(i + 1)}`;
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

const main = () => {
    if (!existsSync(baseDir)) {
        throw new Error(`CSV directory not found: ${baseDir}`);
    }

    const { users, userEmails, usersByRole } = generateUsers();
    writeCsv('users.mock.csv', [
        'uid', 'email', 'firstName', 'middleName', 'lastName', 'prefix', 'suffix', 'role', 'department',
        'phone', 'avatar', 'banner', 'bio', 'password',
    ], users);

    const groups = generateGroups(usersByRole);
    writeCsv('groups.mock.csv', [
        'id', 'name', 'leader', 'members', 'adviser', 'editor', 'description', 'status', 'createdAt',
        'updatedAt', 'thesisTitle', 'department',
    ], groups);

    const schedule = generateSchedule(usersByRole);
    writeCsv('schedule.mock.csv', [
        'id', 'title', 'description', 'calendarId', 'status', 'startDate', 'endDate', 'isAllDay', 'organizer',
        'participants', 'location_address', 'location_room', 'location_url', 'location_platform', 'tags', 'color',
        'createdBy', 'createdAt',
    ], schedule);

    const files = generateFiles(usersByRole, userEmails);
    writeCsv('files.mock.csv', [
        'id', 'name', 'type', 'size', 'url', 'mimeType', 'thumbnail', 'duration', 'uploadDate', 'author', 'category',
    ], files);

    const forms = generateForms(usersByRole, userEmails);
    writeCsv('forms.mock.csv', [
        'id', 'title', 'description', 'version', 'audience', 'status', 'createdAt', 'updatedAt', 'createdBy', 'tags',
        'reviewerNotes', 'dueInDays', 'fields', 'workflow', 'availableToGroups',
    ], forms);

    const theses = generateTheses(groups, usersByRole);
    writeCsv('theses.mock.csv', [
        'title', 'leader', 'members', 'adviser', 'editor', 'submissionDate', 'lastUpdated', 'overallStatus', 'chapters',
    ], theses);

    log('Mock CSV generation complete.');
};

main();
