/**
 * CSV import/export utilities for topic proposal sets.
 */

import type {
    TopicProposalEntry, TopicProposalEntryStatus, TopicProposalReviewEvent,
    TopicProposalReviewerDecision, TopicProposalSetRecord
} from '../../types/proposal';
import { TOPIC_PROPOSAL_ENTRY_STATUSES } from '../../types/proposal';
import { parseCsvText, normalizeHeader, mapHeaderIndexes, parseBoolean, generateCsvText } from './parser';

const nowIso = () => new Date().toISOString();

const coerceEntryStatus = (value?: string): TopicProposalEntryStatus => {
    if (!value) return 'draft';
    const normalized = value.trim().toLowerCase();
    const match = TOPIC_PROPOSAL_ENTRY_STATUSES.find(status => status === normalized);
    return (match ?? 'draft') as TopicProposalEntryStatus;
};

const parseNumberField = (value?: string, fallback = 1): number => {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStringArray = (raw: unknown): string[] => {
    if (Array.isArray(raw)) {
        return raw.map(item => (typeof item === 'string' ? item.trim() : String(item))).filter(Boolean);
    }
    if (typeof raw === 'string') {
        return raw
            .split(/[;,]/)
            .map(part => part.trim())
            .filter(Boolean);
    }
    return [];
};

const mapDecision = (raw: unknown): TopicProposalReviewerDecision | undefined => {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const candidate = raw as Partial<TopicProposalReviewerDecision> & Record<string, unknown>;
    const decision = typeof candidate.decision === 'string' && ['approved', 'rejected'].includes(candidate.decision)
        ? candidate.decision
        : undefined;
    const reviewerUid = typeof candidate.reviewerUid === 'string' ? candidate.reviewerUid : undefined;
    if (!decision || !reviewerUid) {
        return undefined;
    }
    return {
        reviewerUid,
        decision,
        decidedAt: typeof candidate.decidedAt === 'string' && candidate.decidedAt ? candidate.decidedAt : nowIso(),
        notes: typeof candidate.notes === 'string' ? candidate.notes : undefined,
    } satisfies TopicProposalReviewerDecision;
};

const normalizeEntries = (raw: unknown, fallbackAuthor: string): TopicProposalEntry[] => {
    if (!Array.isArray(raw)) {
        return [];
    }

    const entries: TopicProposalEntry[] = [];

    raw.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        const e = entry as Partial<TopicProposalEntry> & Record<string, unknown>;
        const createdAt = typeof e.createdAt === 'string' && e.createdAt ? e.createdAt : nowIso();
        const updatedAt = typeof e.updatedAt === 'string' && e.updatedAt ? e.updatedAt : createdAt;
        const proposedBy = typeof e.proposedBy === 'string' && e.proposedBy ? e.proposedBy : fallbackAuthor;
        const description = typeof e.description === 'string' && e.description
            ? e.description
            : typeof e.abstract === 'string' && e.abstract
                ? e.abstract
                : '';

        entries.push({
            id: typeof e.id === 'string' && e.id ? e.id : `proposal_${index + 1}`,
            title: typeof e.title === 'string' && e.title ? e.title : 'Untitled Topic',
            description,
            problemStatement: typeof e.problemStatement === 'string' ? e.problemStatement : undefined,
            expectedOutcome: typeof e.expectedOutcome === 'string' ? e.expectedOutcome : undefined,
            keywords: parseStringArray(e.keywords),
            proposedBy,
            createdAt,
            updatedAt,
            status: coerceEntryStatus(typeof e.status === 'string' ? e.status : undefined),
            moderatorDecision: mapDecision(e.moderatorDecision),
            headDecision: mapDecision(e.headDecision),
        });
    });

    return entries;
};

const normalizeReviewHistory = (raw: unknown): TopicProposalReviewEvent[] => {
    if (!Array.isArray(raw)) {
        return [];
    }

    const history: TopicProposalReviewEvent[] = [];

    raw.forEach((event, index) => {
        if (!event || typeof event !== 'object') {
            return;
        }
        const e = event as Partial<TopicProposalReviewEvent> & Record<string, unknown>;
        const stage = typeof e.stage === 'string' && (e.stage === 'moderator' || e.stage === 'head')
            ? e.stage
            : 'moderator';
        const decision = typeof e.decision === 'string' && (e.decision === 'approved' || e.decision === 'rejected')
            ? e.decision
            : 'approved';
        const reviewerUid = typeof e.reviewerUid === 'string' ? e.reviewerUid : '';
        if (!reviewerUid) {
            return;
        }
        const proposalId = typeof e.proposalId === 'string' && e.proposalId ? e.proposalId : `proposal_${index + 1}`;

        history.push({
            stage,
            decision,
            reviewerUid,
            proposalId,
            notes: typeof e.notes === 'string' ? e.notes : undefined,
            reviewedAt: typeof e.reviewedAt === 'string' && e.reviewedAt ? e.reviewedAt : nowIso(),
        });
    });

    return history;
};

const parseJsonField = (raw?: string): unknown => {
    if (!raw) return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
};

/**
 * Import topic proposal sets from CSV.
 */
export function importTopicProposalsFromCsv(csvText: string): { parsed: TopicProposalSetRecord[]; errors: string[] } {
    const { headers, rows } = parseCsvText(csvText);
    const headerMap = mapHeaderIndexes(headers);
    const parsed: TopicProposalSetRecord[] = [];
    const errors: string[] = [];

    const getCell = (row: string[], name: string): string => {
        const idx = headerMap[normalizeHeader(name)];
        return idx !== undefined ? row[idx] ?? '' : '';
    };

    rows.forEach((row, idx) => {
        const id = getCell(row, 'id') || `topic_set_${idx + 1}`;
        const groupId = getCell(row, 'groupId') || getCell(row, 'group_id');
        if (!groupId) {
            errors.push(`row ${idx + 2}: missing groupId`);
            return;
        }

        const createdBy = getCell(row, 'createdBy') || getCell(row, 'created_by');
        const createdAt = getCell(row, 'createdAt') || getCell(row, 'created_at') || nowIso();
        const updatedAt = getCell(row, 'updatedAt') || getCell(row, 'updated_at') || createdAt;
        const setValueRaw = getCell(row, 'set') || getCell(row, 'cycle'); // legacy CSVs used "cycle"
        const setNumber = parseNumberField(setValueRaw, 1);
        const awaitingModerator = parseBoolean(getCell(row, 'awaitingModerator'));
        const awaitingHead = parseBoolean(getCell(row, 'awaitingHead'));
        const submittedBy = getCell(row, 'submittedBy') || getCell(row, 'submitted_by') || undefined;
        const submittedAt = getCell(row, 'submittedAt') || getCell(row, 'submitted_at') || undefined;
        const usedBy = getCell(row, 'usedBy') || getCell(row, 'used_by') || undefined;
        const usedAsThesisAt = getCell(row, 'usedAsThesisAt') || getCell(row, 'used_as_thesis_at') || undefined;

        const entriesRaw = parseJsonField(getCell(row, 'entries'));
        const entries = normalizeEntries(entriesRaw, createdBy);
        const reviewHistoryRaw = parseJsonField(getCell(row, 'reviewHistory'));
        const reviewHistory = normalizeReviewHistory(reviewHistoryRaw);

        const record: TopicProposalSetRecord = {
            id,
            groupId,
            createdBy,
            createdAt,
            updatedAt,
            set: setNumber,
            entries,
            awaitingModerator,
            awaitingHead,
            submittedBy,
            submittedAt,
            usedBy,
            usedAsThesisAt,
            reviewHistory,
        };

        parsed.push(record);
    });

    return { parsed, errors };
}

/**
 * Export topic proposal sets to CSV text.
 */
export function exportTopicProposalsToCsv(records: TopicProposalSetRecord[]): string {
    const headers = [
        'id',
        'groupId',
        'createdBy',
        'createdAt',
        'updatedAt',
        'set',
        'awaitingModerator',
        'awaitingHead',
        'submittedBy',
        'submittedAt',
        'usedBy',
        'usedAsThesisAt',
        'entries',
        'reviewHistory',
    ];

    const rows = records.map(record => [
        record.id,
        record.groupId,
        record.createdBy,
        record.createdAt,
        record.updatedAt,
        record.set.toString(),
        record.awaitingModerator ? 'true' : 'false',
        record.awaitingHead ? 'true' : 'false',
        record.submittedBy ?? '',
        record.submittedAt ?? '',
        // approvedEntryId removed: rely on per-entry status instead
        record.usedBy ?? '',
        record.usedAsThesisAt ?? '',
        JSON.stringify(record.entries ?? []),
        JSON.stringify(record.reviewHistory ?? []),
    ]);

    return generateCsvText(headers, rows);
}
