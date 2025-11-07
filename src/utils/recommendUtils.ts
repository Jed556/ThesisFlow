import type { ThesisData } from '../types/thesis';
import type { UserProfile } from '../types/profile';
import { normalizeDateInput } from './dateUtils';

export interface ThesisRoleStats {
    adviserCount: number;
    editorCount: number;
}

export interface MentorCardData {
    profile: UserProfile;
    stats: ThesisRoleStats;
    compatibility: number;
    capacity: number;
    activeCount: number;
    openSlots: number;
    rank: number;
}

/**
 * Aggregates counts of adviser and editor roles handled by each user across all theses.
 * \@param theses List of theses to analyze
 * @return Map of user UIDs to their thesis role statistics
 */
export function aggregateThesisStats(theses: (ThesisData & { id: string })[]): Map<string, ThesisRoleStats> {
    const stats = new Map<string, ThesisRoleStats>();

    theses.forEach((thesis) => {
        if (thesis.adviser) {
            const record = stats.get(thesis.adviser) ?? { adviserCount: 0, editorCount: 0 };
            stats.set(thesis.adviser, {
                adviserCount: record.adviserCount + 1,
                editorCount: record.editorCount,
            });
        }
        if (thesis.editor) {
            const record = stats.get(thesis.editor) ?? { adviserCount: 0, editorCount: 0 };
            stats.set(thesis.editor, {
                adviserCount: record.adviserCount,
                editorCount: record.editorCount + 1,
            });
        }
    });

    return stats;
}

/**
 * Computes mentor recommendation cards sorted by compatibility, capacity, and expertise.
 * @param profiles List of user profiles to evaluate as mentors
 * @param role Role to consider ('adviser' or 'editor')
 * @param statsMap Precomputed thesis role statistics for users
 * @return List of MentorCardData sorted by rank
 */
export function computeMentorCards(
    profiles: UserProfile[],
    role: 'adviser' | 'editor',
    statsMap: Map<string, ThesisRoleStats>,
): MentorCardData[] {
    const scored = profiles.map((profile) => {
        const stats = statsMap.get(profile.uid) ?? { adviserCount: 0, editorCount: 0 };
        const capacity = role === 'adviser' ? profile.adviserCapacity ?? 0 : profile.editorCapacity ?? 0;
        const active = role === 'adviser' ? stats.adviserCount : stats.editorCount;
        const openSlots = capacity > 0 ? Math.max(capacity - active, 0) : 0;
        const compatibility = computeCompatibility(profile, stats, role);
        const score = compatibility + openSlots * 5 + (profile.skills?.length ?? 0) * 2;

        return {
            profile,
            stats,
            compatibility,
            capacity,
            activeCount: active,
            openSlots,
            score,
        };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.map((entry, index) => ({
        profile: entry.profile,
        stats: entry.stats,
        compatibility: entry.compatibility,
        capacity: entry.capacity,
        activeCount: entry.activeCount,
        openSlots: entry.openSlots,
        rank: index + 1,
    }));
}

/**
 * Generates a recency score that weights mentors who were active recently.
 */
function computeRecencyScore(date: Date | null): number {
    if (!date) return 0;
    const diffMs = Date.now() - date.getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) {
        return 20;
    }
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return 20;
    if (diffDays >= 30) return 0;
    return Math.round((30 - diffDays) * (20 / 30));
}

/**
 * Calculates mentor compatibility using availability, skills coverage, and activity recency.
 */
function computeCompatibility(profile: UserProfile, stats: ThesisRoleStats, role: 'adviser' | 'editor'): number {
    const capacity = role === 'adviser' ? profile.adviserCapacity ?? 0 : profile.editorCapacity ?? 0;
    const active = role === 'adviser' ? stats.adviserCount : stats.editorCount;
    const openSlots = capacity > 0 ? Math.max(capacity - active, 0) : 0;
    const availabilityRatio = capacity > 0 ? openSlots / capacity : 0;
    const availabilityScore = Math.round(availabilityRatio * 40);
    const skillsScore = Math.min((profile.skills?.length ?? 0) * 5, 20);
    const recencyScore = computeRecencyScore(normalizeDateInput(profile.lastActive));
    const penalty = Math.min(active * 3, 15);
    const baseScore = 40;
    const total = baseScore + availabilityScore + skillsScore + recencyScore - penalty;
    return Math.max(0, Math.min(100, Math.round(total)));
}
