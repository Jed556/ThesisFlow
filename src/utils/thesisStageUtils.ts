import type { ThesisChapter, ThesisStageName } from '../types/thesis';

export interface ThesisStageMeta {
    value: ThesisStageName;
    label: string;
    helper?: string;
}

export const THESIS_STAGE_METADATA: readonly ThesisStageMeta[] = [
    { value: 'Pre-Proposal', label: 'Pre-Proposal' },
    { value: 'Post-Proposal', label: 'Post-Proposal' },
    { value: 'Pre-Defense', label: 'Pre Defense' },
    { value: 'Post-Defense', label: 'Post Defense' },
];

const STAGE_SEQUENCE_ORDER = THESIS_STAGE_METADATA.map((stage) => stage.value);

const normalizeStageKey = (value: string): string => value
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const STAGE_LOOKUP = STAGE_SEQUENCE_ORDER.reduce<Map<string, ThesisStageName>>((acc, stage) => {
    acc.set(normalizeStageKey(stage), stage);
    return acc;
}, new Map());

export type StageSequenceTarget = 'chapters' | 'terminal';

export interface StageSequenceStep {
    stage: ThesisStageName;
    target: StageSequenceTarget;
}

export const THESIS_STAGE_UNLOCK_SEQUENCE: readonly StageSequenceStep[] = [
    { stage: 'Pre-Proposal', target: 'chapters' },
    { stage: 'Pre-Proposal', target: 'terminal' },
    { stage: 'Post-Proposal', target: 'chapters' },
    { stage: 'Post-Proposal', target: 'terminal' },
    { stage: 'Pre-Defense', target: 'chapters' },
    { stage: 'Pre-Defense', target: 'terminal' },
    { stage: 'Post-Defense', target: 'chapters' },
    { stage: 'Post-Defense', target: 'terminal' },
] as const;

const DEFAULT_STAGE: ThesisStageName = THESIS_STAGE_METADATA[0]?.value ?? 'Pre-Proposal';

function canonicalizeStageValue(value?: ThesisStageName | string | null): ThesisStageName | null {
    if (!value) {
        return null;
    }
    const normalized = normalizeStageKey(value.toString());
    return STAGE_LOOKUP.get(normalized) ?? null;
}

function normalizeChapterStages(stage?: ThesisStageName | ThesisStageName[] | null): ThesisStageName[] {
    const values = Array.isArray(stage)
        ? stage
        : stage
            ? [stage]
            : [];

    const canonical = values
        .map((value) => canonicalizeStageValue(value))
        .filter((value): value is ThesisStageName => Boolean(value));

    const unique: ThesisStageName[] = [];
    canonical.forEach((value) => {
        if (!unique.includes(value)) {
            unique.push(value);
        }
    });

    if (unique.length === 0) {
        return [DEFAULT_STAGE];
    }

    return unique.sort((a, b) => {
        const aIndex = STAGE_SEQUENCE_ORDER.indexOf(a);
        const bIndex = STAGE_SEQUENCE_ORDER.indexOf(b);
        if (aIndex === -1 && bIndex === -1) {
            return 0;
        }
        if (aIndex === -1) {
            return 1;
        }
        if (bIndex === -1) {
            return -1;
        }
        return aIndex - bIndex;
    });
}

export function resolveChapterStages(chapter?: ThesisChapter | null): ThesisStageName[] {
    if (!chapter) {
        return [DEFAULT_STAGE];
    }
    return normalizeChapterStages(chapter.stage);
}

/**
 * Returns the normalized stage assigned to a thesis chapter.
 */
export function resolveChapterStage(chapter?: ThesisChapter | null): ThesisStageName {
    return resolveChapterStages(chapter)[0];
}

export function chapterHasStage(chapter: ThesisChapter | undefined, stage: ThesisStageName): boolean {
    if (!chapter) {
        return false;
    }
    return resolveChapterStages(chapter).includes(stage);
}

export interface StageCompletionOptions {
    treatEmptyAsComplete?: boolean;
}

/**
 * Builds a map describing whether each thesis stage has all chapters approved.
 */
export function buildStageCompletionMap(
    chapters: ThesisChapter[] | undefined,
    options?: StageCompletionOptions,
): Record<ThesisStageName, boolean> {
    const source = chapters ?? [];
    const { treatEmptyAsComplete = false } = options ?? {};
    return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, boolean>>((acc, stageMeta) => {
        const stageChapters = filterChaptersByStage(source, stageMeta.value);
        if (stageChapters.length === 0) {
            acc[stageMeta.value] = treatEmptyAsComplete;
        } else {
            acc[stageMeta.value] = stageChapters.every((chapter) => chapter.status === 'approved');
        }
        return acc;
    }, {} as Record<ThesisStageName, boolean>);
}

/**
 * Determines the current "in progress" stage based on completion and lock maps.
 * Returns the first stage that is unlocked and not yet completed.
 * If all unlocked stages are complete, returns the last unlocked stage.
 * If all stages are locked, returns the first stage.
 * @param completionMap - A map of stage to completion status
 * @param lockMap - Optional map of stage to locked status (true = locked)
 * @returns The stage name that is currently in progress
 */
export function getCurrentInProgressStage(
    completionMap?: Partial<Record<ThesisStageName, boolean>> | null,
    lockMap?: Partial<Record<ThesisStageName, boolean>> | null
): ThesisStageName {
    if (!completionMap) {
        return DEFAULT_STAGE;
    }

    // Find the first stage that is unlocked and not completed
    let lastUnlockedStage: ThesisStageName | null = null;
    for (const stageMeta of THESIS_STAGE_METADATA) {
        const isLocked = lockMap?.[stageMeta.value] ?? false;
        const isComplete = completionMap[stageMeta.value] ?? false;

        if (!isLocked) {
            lastUnlockedStage = stageMeta.value;
            if (!isComplete) {
                return stageMeta.value;
            }
        }
    }

    // All unlocked stages are complete - return the last unlocked stage
    if (lastUnlockedStage) {
        return lastUnlockedStage;
    }

    // All stages locked - return first stage
    return DEFAULT_STAGE;
}

/**
 * Builds a lock map where each stage is locked until the previous stage is complete.
 */
export function buildSequentialStageLockMap(
    completionMap: Record<ThesisStageName, boolean>
): Record<ThesisStageName, boolean> {
    return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, boolean>>((acc, stageMeta, index) => {
        if (index === 0) {
            acc[stageMeta.value] = false;
        } else {
            const previousStage = THESIS_STAGE_METADATA[index - 1].value;
            acc[stageMeta.value] = !(completionMap[previousStage] ?? false);
        }
        return acc;
    }, {} as Record<ThesisStageName, boolean>);
}

export interface StageProgressSnapshot {
    chapters?: Partial<Record<ThesisStageName, boolean>>;
    terminalRequirements?: Partial<Record<ThesisStageName, boolean>>;
}

export interface StageInterleavedLockMap {
    chapters: Record<ThesisStageName, boolean>;
    terminalRequirements: Record<ThesisStageName, boolean>;
}

export interface StageGateOverrides {
    chapters?: Partial<Record<ThesisStageName, boolean>>;
    terminalRequirements?: Partial<Record<ThesisStageName, boolean>>;
}

const describeTargetLabel: Record<StageSequenceTarget, string> = {
    chapters: 'chapters',
    terminal: 'terminal requirements',
};

export function describeStageSequenceStep(step: StageSequenceStep): string {
    return `${step.stage} ${describeTargetLabel[step.target]}`;
}

export function getPreviousSequenceStep(
    stage: ThesisStageName,
    target: StageSequenceTarget,
): StageSequenceStep | null {
    const index = THESIS_STAGE_UNLOCK_SEQUENCE.findIndex(
        (entry) => entry.stage === stage && entry.target === target,
    );
    if (index <= 0) {
        return null;
    }
    return THESIS_STAGE_UNLOCK_SEQUENCE[index - 1];
}

export function buildInterleavedStageLockMap(
    progress: StageProgressSnapshot,
    gates?: StageGateOverrides,
): StageInterleavedLockMap {
    const locks: StageInterleavedLockMap = {
        chapters: {} as Record<ThesisStageName, boolean>,
        terminalRequirements: {} as Record<ThesisStageName, boolean>,
    };
    let previousStepComplete = true;

    THESIS_STAGE_UNLOCK_SEQUENCE.forEach((step) => {
        const targetLockMap = step.target === 'chapters'
            ? locks.chapters
            : locks.terminalRequirements;
        const gateReady = step.target === 'chapters'
            ? gates?.chapters?.[step.stage]
            : gates?.terminalRequirements?.[step.stage];
        const gateSatisfied = gateReady ?? true;
        targetLockMap[step.stage] = !(previousStepComplete && gateSatisfied);

        const completionSource = step.target === 'chapters'
            ? progress.chapters
            : progress.terminalRequirements;
        const stageComplete = Boolean(completionSource?.[step.stage]);
        previousStepComplete = stageComplete;
    });

    return locks;
}

/**
 * Returns all chapters assigned to the provided stage value.
 */
export function filterChaptersByStage(
    chapters: ThesisChapter[] | undefined,
    stage: ThesisStageName,
): ThesisChapter[] {
    if (!chapters || chapters.length === 0) {
        return [];
    }
    return chapters.filter((chapter) => chapterHasStage(chapter, stage));
}
