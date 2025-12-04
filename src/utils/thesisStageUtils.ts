import type { ThesisChapter, ThesisData, ThesisStageName } from '../types/thesis';
import StagesConfig from '../config/stages.json';

export interface ThesisStageMeta {
    value: ThesisStageName;
    label: string;
    helper?: string;
}

/**
 * Metadata for thesis stages derived from JSON config
 * Uses slug as the value (for database operations) and name as the label (for display)
 */
export const THESIS_STAGE_METADATA: readonly ThesisStageMeta[] = StagesConfig.stages.map(
    (stage) => ({
        value: stage.slug as ThesisStageName,
        label: stage.name,
    })
);

const STAGE_SEQUENCE_ORDER = THESIS_STAGE_METADATA.map((stage) => stage.value);

/** Default stage when none can be determined */
const DEFAULT_STAGE: ThesisStageName = THESIS_STAGE_METADATA[0]?.value as ThesisStageName;

const normalizeStageKey = (value: string): string => value
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/**
 * Lookup map for stage canonicalization.
 * Maps both slugs and full names to their canonical slug values.
 */
const STAGE_LOOKUP = StagesConfig.stages.reduce<Map<string, ThesisStageName>>((acc, stage) => {
    const slug = stage.slug as ThesisStageName;
    // Map normalized slug (e.g., "preproposal" -> "pre-proposal")
    acc.set(normalizeStageKey(stage.slug), slug);
    // Map normalized full name (e.g., "preproposaloraldefense" -> "pre-proposal")
    acc.set(normalizeStageKey(stage.name), slug);
    return acc;
}, new Map());

export type StageSequenceTarget = 'chapters' | 'terminal';

export interface StageSequenceStep {
    stage: ThesisStageName;
    target: StageSequenceTarget;
}

/**
 * Thesis stage unlock sequence derived from JSON config
 * Each stage has chapters and terminal requirements
 */
export const THESIS_STAGE_UNLOCK_SEQUENCE: readonly StageSequenceStep[] = StagesConfig.stages.flatMap(
    (stage) => [
        { stage: stage.slug as ThesisStageName, target: 'chapters' as const },
        { stage: stage.slug as ThesisStageName, target: 'terminal' as const },
    ]
);

/**
 * Canonicalizes a stage value to its slug form.
 * Handles both slug format ("pre-proposal") and full name format ("Pre-Proposal Oral Defense").
 * Returns null if the value cannot be canonicalized.
 */
export function canonicalizeStageValue(value?: ThesisStageName | string | null): ThesisStageName | null {
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
 * Determines if a chapter is approved based on its submissions or isApproved flag.
 * A chapter is considered approved if:
 * 1. It has the isApproved flag set to true (set when a submission is approved), OR
 * 2. It has at least one approved submission in its submissions array
 */
function isChapterApproved(chapter: ThesisChapter): boolean {
    // Check the isApproved flag first (set by updateSubmissionDecision)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((chapter as any).isApproved === true) {
        return true;
    }
    // Fallback: check submissions array for approved status
    if (!chapter.submissions || chapter.submissions.length === 0) {
        return false;
    }
    // Check if any submission has status 'approved'
    return chapter.submissions.some((submission) => submission.status === 'approved');
}

/**
 * Builds a map describing whether each thesis stage has all chapters approved.
 * Status is now derived from chapter submissions (per-file approval status).
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
            acc[stageMeta.value] = stageChapters.every((chapter) => isChapterApproved(chapter));
        }
        return acc;
    }, {} as Record<ThesisStageName, boolean>);
}

/**
 * Builds a map describing whether each thesis stage has started (has any chapters).
 * A stage is considered "started" if there is at least one chapter assigned to it.
 */
export function buildStageStartedMap(
    chapters: ThesisChapter[] | undefined,
): Record<ThesisStageName, boolean> {
    const source = chapters ?? [];
    return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, boolean>>((acc, stageMeta) => {
        const stageChapters = filterChaptersByStage(source, stageMeta.value);
        acc[stageMeta.value] = stageChapters.length > 0;
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

/**
 * Derives the current stage of a thesis from its data.
 * 
 * Priority:
 * 1. If stages array exists and has entries, use the last stage's name
 * 2. Default to first stage from config
 * 
 * Note: Chapters are now stored in a subcollection, not embedded in thesis.
 * Use buildStageCompletionMap with separately-fetched chapters if chapter-based
 * stage derivation is needed.
 * 
 * @param thesis - Thesis data object
 * @returns The derived current stage name
 */
export function deriveCurrentStage(thesis: ThesisData | null | undefined): ThesisStageName {
    if (!thesis) {
        return DEFAULT_STAGE;
    }

    // Method 1: Check stages array (if properly populated)
    if (thesis.stages && thesis.stages.length > 0) {
        const lastStage = thesis.stages[thesis.stages.length - 1];
        if (lastStage?.name && STAGE_SEQUENCE_ORDER.includes(lastStage.name)) {
            return lastStage.name;
        }
    }

    // Method 2: Check if stages array exists but stages have different structure
    // (stages might be stored as objects with different property names)
    if (thesis.stages && thesis.stages.length > 0) {
        const lastStage = thesis.stages[thesis.stages.length - 1] as unknown as Record<string, unknown>;
        // Try common property name variations
        const possibleNameProps = ['name', 'stageName', 'stage', 'title'];
        for (const prop of possibleNameProps) {
            const value = lastStage[prop];
            if (typeof value === 'string') {
                const canonical = canonicalizeStageValue(value);
                if (canonical) {
                    return canonical;
                }
            }
        }
    }

    return DEFAULT_STAGE;
}
