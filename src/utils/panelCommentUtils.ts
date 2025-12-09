/**
 * Helper utilities for panel comment workflows shared across multiple pages.
 */
import type { PanelCommentReleaseMap, PanelCommentStage } from '../types/panelComment';
import type { ThesisStageName } from '../types/thesis';
import type { UserProfile } from '../types/profile';
import StagesConfig from '../config/stages.json';

export interface PanelCommentStageMeta {
    id: PanelCommentStage;
    studentLabel: string;
    adminLabel: string;
    description: string;
    /** Stage whose terminal requirements must be approved to unlock panel comments for students */
    terminalUnlockStage: ThesisStageName;
    /** Stage label used for admin release messaging */
    releaseStageLabel: string;
}

// Get stage names from config for panel comment metadata
const [preProposal, postProposal, preDefense, postDefense] = StagesConfig.stages.map(s => s.name) as [string, string, string, string];

export const PANEL_COMMENT_STAGE_METADATA: readonly PanelCommentStageMeta[] = [
    {
        id: 'proposal',
        studentLabel: 'Proposal',
        adminLabel: postProposal,
        description: 'Includes panel notes from the proposal hearing.',
        terminalUnlockStage: preProposal as ThesisStageName,
        releaseStageLabel: preProposal,
    },
    {
        id: 'defense',
        studentLabel: 'Defense',
        adminLabel: postDefense,
        description: 'Captures final defense deliberations and required revisions.',
        terminalUnlockStage: preDefense as ThesisStageName,
        releaseStageLabel: preDefense,
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
 * Determines whether a student can access a specific panelist's table for a stage.
 * A stage becomes accessible when the admin has released the specific panelist's table.
 * @param stage - The panel comment stage
 * @param releaseMap - The release map containing per-table release status
 * @param panelUid - The panelist's UID whose table to check
 */
export function canStudentAccessPanelStage(
    stage: PanelCommentStage,
    releaseMap: PanelCommentReleaseMap | undefined,
    panelUid: string | null | undefined,
): boolean {
    if (!releaseMap || !panelUid) return false;
    const stageRelease = releaseMap[stage];
    // Check per-table release first
    if (stageRelease?.tables?.[panelUid]?.sent) {
        return true;
    }
    // Fall back to stage-level release (legacy behavior)
    return Boolean(stageRelease?.sent);
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
 * Checks if ANY panel table has been released for a stage.
 * This checks both the legacy stage-level release and per-table releases.
 * @param stage - The panel comment stage
 * @param releaseMap - The release map containing release status
 * @returns Whether any table has been released for the stage
 */
export function isAnyTableReleasedForStage(
    stage: PanelCommentStage,
    releaseMap: PanelCommentReleaseMap | undefined
): boolean {
    if (!releaseMap) return false;
    const stageRelease = releaseMap[stage];
    // Check stage-level release (legacy)
    if (stageRelease?.sent) {
        return true;
    }
    // Check if any per-table release exists
    const tables = stageRelease?.tables;
    if (tables) {
        return Object.values(tables).some((tableRelease) => tableRelease?.sent === true);
    }
    return false;
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
