/**
 * Helper utilities for panel comment workflows shared across multiple pages.
 */
import type { PanelCommentReleaseMap, PanelCommentStage } from '../types/panelComment';
import type { ThesisStage } from '../types/thesis';

export interface PanelCommentStageMeta {
    id: PanelCommentStage;
    studentLabel: string;
    adminLabel: string;
    description: string;
    unlockStage: ThesisStage;
}

export const PANEL_COMMENT_STAGE_METADATA: readonly PanelCommentStageMeta[] = [
    {
        id: 'proposal',
        studentLabel: 'Proposal',
        adminLabel: 'Post-Proposal',
        description: 'Includes panel notes from the proposal hearing.',
        unlockStage: 'Pre-Proposal',
    },
    {
        id: 'defense',
        studentLabel: 'Defense',
        adminLabel: 'Post-Defense',
        description: 'Captures final defense deliberations and required revisions.',
        unlockStage: 'Pre-Defense',
    },
] as const;

/**
 * Returns metadata for a given panel comment stage.
 */
export function getPanelCommentStageMeta(stage: PanelCommentStage): PanelCommentStageMeta | undefined {
    return PANEL_COMMENT_STAGE_METADATA.find((meta) => meta.id === stage);
}

export type StageCompletionMap = Partial<Record<ThesisStage, boolean>>;

/**
 * Determines whether a student should see a specific stage tab.
 * A stage becomes accessible when the linked thesis stage is completed and admin released the comments.
 */
export function canStudentAccessPanelStage(
    stage: PanelCommentStage,
    completionMap: StageCompletionMap | undefined,
    releaseMap: PanelCommentReleaseMap | undefined
): boolean {
    const meta = getPanelCommentStageMeta(stage);
    if (!meta) {
        return false;
    }
    const stageReady = completionMap?.[meta.unlockStage] ?? false;
    const releaseReady = releaseMap?.[stage]?.sent ?? false;
    return stageReady && releaseReady;
}

/**
 * Returns the label suited for either the student or admin tab context.
 */
export function getPanelCommentStageLabel(stage: PanelCommentStage, variant: 'student' | 'admin' = 'student'): string {
    const meta = getPanelCommentStageMeta(stage);
    if (!meta) {
        return stage;
    }
    return variant === 'admin' ? meta.adminLabel : meta.studentLabel;
}

/**
 * Helper exposing the release flag for convenience in UI bindings.
 */
export function isPanelCommentStageReleased(
    stage: PanelCommentStage,
    releaseMap: PanelCommentReleaseMap | undefined
): boolean {
    return Boolean(releaseMap?.[stage]?.sent);
}
