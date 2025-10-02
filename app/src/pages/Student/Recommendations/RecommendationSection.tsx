import { useMemo } from 'react';
import { AccessTime, Groups } from '@mui/icons-material';
import { Box, Card, CardContent, Chip, Divider, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import Avatar, { NAME_PRESETS } from '../../../components/Avatar/Avatar';
import type { RecommendationEntry } from '../../../types/recommendation';
import { getDisplayName, getProfile } from '../../../utils/dbUtils';

interface RecommendationSectionProps {
    /** Page heading shown above the recommendations list. */
    heading: string;
    /** Supporting description displayed under the heading. */
    description: string;
    /** Recommendation entries to render. */
    entries: RecommendationEntry[];
}

interface AvailabilityInfo {
    label: string;
    color: 'success' | 'warning' | 'error';
    remainingSlots: number;
}

/**
 * Computes display metadata used to highlight a faculty member's availability.
 * @param entry Recommendation row containing capacity details.
 * @returns Availability label, chip color, and remaining slot count.
 */
function resolveAvailability(entry: RecommendationEntry): AvailabilityInfo {
    const remaining = Math.max(entry.capacity - entry.currentAssignments, 0);

    if (remaining >= 2) {
        return {
            label: 'Actively accepting teams',
            color: 'success',
            remainingSlots: remaining,
        };
    }

    if (remaining === 1) {
        return {
            label: 'Limited availability',
            color: 'warning',
            remainingSlots: remaining,
        };
    }

    return {
        label: 'Fully booked',
        color: 'error',
        remainingSlots: remaining,
    };
}

/**
 * Displays a stack of recommendation cards that surface match scores, expertise areas,
 * and workload signals for suggested advisers or editors.
 */
export default function RecommendationSection({ heading, description, entries }: RecommendationSectionProps) {
    const sortedEntries = useMemo(
        () => [...entries].sort((a, b) => b.matchScore - a.matchScore),
        [entries]
    );

    return (
        <Stack spacing={3}>
            <Box>
                <Typography variant="h4" gutterBottom>
                    {heading}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {description}
                </Typography>
            </Box>

            {sortedEntries.map((entry) => {
                const profile = getProfile(entry.userEmail);
                const availability = resolveAvailability(entry);

                return (
                    <Card key={entry.id} variant="outlined">
                        <CardContent>
                            <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={3}
                                alignItems={{ xs: 'flex-start', md: 'center' }}
                            >
                                <Avatar
                                    email={entry.userEmail}
                                    initials={NAME_PRESETS.academic}
                                    size={64}
                                    tooltip="full"
                                />

                                <Box sx={{ flex: 1, width: '100%' }}>
                                    <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        justifyContent="space-between"
                                        spacing={2}
                                    >
                                        <Box>
                                            <Typography variant="h6">
                                                {getDisplayName(entry.userEmail)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {profile?.department ?? 'Department update pending'}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={availability.label}
                                            color={availability.color}
                                            variant="outlined"
                                        />
                                    </Stack>

                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            Compatibility score
                                        </Typography>
                                        <Tooltip title={`Match score: ${entry.matchScore}%`} arrow>
                                            <LinearProgress
                                                variant="determinate"
                                                value={entry.matchScore}
                                                sx={{ mt: 0.5, height: 10, borderRadius: 5 }}
                                            />
                                        </Tooltip>
                                    </Box>

                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mt: 2 }}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Groups color="primary" fontSize="small" />
                                            <Typography variant="body2">
                                                {entry.currentAssignments} of {entry.capacity} teams supported
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <AccessTime color="primary" fontSize="small" />
                                            <Typography variant="body2">
                                                Avg. feedback: ~{entry.avgResponseHours} hrs
                                            </Typography>
                                        </Stack>
                                    </Stack>

                                    <Divider sx={{ my: 2 }} />

                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="subtitle2" gutterBottom>
                                                Expertise focus
                                            </Typography>
                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                {entry.expertiseAreas.map((area) => (
                                                    <Chip
                                                        key={area}
                                                        label={area}
                                                        size="small"
                                                        variant="filled"
                                                        color="default"
                                                    />
                                                ))}
                                            </Stack>
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="subtitle2" gutterBottom>
                                                Recent thesis support
                                            </Typography>
                                            <Stack spacing={0.5}>
                                                {entry.recentProjects.map((project) => (
                                                    <Typography key={project} variant="body2" color="text.secondary">
                                                        • {project}
                                                    </Typography>
                                                ))}
                                            </Stack>
                                        </Box>
                                    </Stack>

                                    {entry.notes && (
                                        <Typography variant="body2" sx={{ mt: 2 }}>
                                            {entry.notes}
                                        </Typography>
                                    )}
                                </Box>
                            </Stack>
                        </CardContent>
                    </Card>
                );
            })}
        </Stack>
    );
}
