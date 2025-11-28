/**
 * Helper utilities for panel comment workflows shared across multiple pages.
 */
import type { PanelCommentReleaseMap, PanelCommentStage } from '../types/panelComment';
import type { ThesisStageName } from '../types/thesis';
import type { UserProfile } from '../types/profile';

export interface PanelCommentStageMeta {
    id: PanelCommentStage;
    studentLabel: string;
    adminLabel: string;
    description: string;
    unlockStage: ThesisStageName;
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

export type StageCompletionMap = Partial<Record<ThesisStageName, boolean>>;

/**
 * Determines whether a student should see a specific stage tab.
 * A stage becomes accessible when the linked thesis stage is completed and admin released the comments.
 */
export function canStudentAccessPanelStage(
    stage: PanelCommentStage,
    _completionMap: StageCompletionMap | undefined,
    releaseMap: PanelCommentReleaseMap | undefined
): boolean {
    return Boolean(releaseMap?.[stage]?.sent);
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

/**
 * Formats a concise display name for panel members, falling back to their email prefix.
 */
export function formatPanelistDisplayName(
    profile: Pick<UserProfile, 'name' | 'email'> | null | undefined,
    fallback = 'Panel member'
): string {
    if (!profile) {
        return fallback;
    }

    const { name, email } = profile;
    const parts = [name?.prefix, name?.first, name?.middle, name?.last, name?.suffix]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));

    if (parts.length > 0) {
        return parts.join(' ');
    }

    if (email) {
        return email.split('@')[0] || fallback;
    }

    return fallback;
}
