import * as React from 'react';
import { Box } from '@mui/material';
import ProfileCard, { type ProfileCardStat } from './ProfileCard';
import type { MentorCardData } from '../../utils/recommendUtils';
import type { UserProfile } from '../../types/profile';

export interface RecommendationProfileCardProps {
    card: MentorCardData;
    roleLabel: 'Adviser' | 'Editor' | 'Statistician';
    onSelect?: (profile: UserProfile) => void;
    showRoleLabel?: boolean;
    disabled?: boolean;
}

/**
 * Compact mentor card tailored for the recommendations grid.
 */
export default function RecommendationProfileCard({
    card, roleLabel, onSelect,
    showRoleLabel = false,
    disabled = false,
}: RecommendationProfileCardProps) {
    const stats = React.useMemo<ProfileCardStat[]>(() => {
        const filledSlots = card.capacity > 0
            ? `${card.activeCount}/${card.capacity}`
            : `${card.activeCount}/0`;

        const baseStats: ProfileCardStat[] = [
            {
                label: 'Active Teams',
                value: card.activeCount,
            },
            {
                label: 'Slots',
                value: filledSlots,
            },
        ];

        if (roleLabel !== 'Editor') {
            baseStats.push({
                label: 'Compatibility',
                value: `${card.compatibility}%`,
            });
        }

        return baseStats;
    }, [card.activeCount, card.capacity, card.compatibility, roleLabel]);

    const handleClick = React.useCallback(() => {
        if (!onSelect) return;
        onSelect(card.profile);
    }, [card.profile, onSelect]);

    const hasSkills = (card.profile.skills?.length ?? 0) > 0;

    return (
        <Box sx={{ position: 'relative', opacity: disabled ? 0.65 : 1, filter: disabled ? 'grayscale(0.25)' : 'none' }}>
            {disabled ? (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        bgcolor: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: 1,
                        pointerEvents: 'none',
                    }}
                />
            ) : null}
            <ProfileCard
                profile={card.profile}
                roleLabel={showRoleLabel ? roleLabel : undefined}
                showEmail={true}
                showRole={showRoleLabel}
                showDepartment={false}
                skills={card.profile.skills ?? []}
                stats={stats}
                cornerText={card.rank}
                showDivider
                showSkills={hasSkills}
                onClick={onSelect && !disabled ? handleClick : undefined}
            />
        </Box>
    );
}
