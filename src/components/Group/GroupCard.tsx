import * as React from 'react';
import {
    Box,
    Card,
    CardActionArea,
    CardActions,
    CardContent,
    Chip,
    Stack,
    Typography,
} from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import type { ThesisGroup } from '../../types/group';
import type { ThesisData } from '../../types/thesis';
import type { UserProfile } from '../../types/profile';
import { GROUP_STATUS_COLORS, formatGroupStatus } from './constants';

interface GroupCardProps {
    group: ThesisGroup;
    /** Optional thesis data. When provided, thesis title is shown instead of placeholder. */
    thesis?: ThesisData | null;
    usersByUid: Map<string, UserProfile>;
    onClick?: (group: ThesisGroup) => void;
    footer?: React.ReactNode;
    actions?: React.ReactNode;
}

const getUserDisplayName = (profile: UserProfile | undefined): string => {
    if (!profile) {
        return '—';
    }
    const first = profile.name?.first?.trim();
    const last = profile.name?.last?.trim();
    const fallback = profile.email;
    const name = [first, last].filter(Boolean).join(' ');
    return name || fallback;
};

/**
 * Displays a thesis group summary inside a clickable card.
 * Actions (edit/delete) have been moved to the group view page.
 */
export default function GroupCard({ group, thesis, usersByUid, onClick, footer, actions }: GroupCardProps) {
    const leaderProfile = usersByUid.get(group.members.leader);
    // Count leader + members for total team size
    const memberCount = 1 + (group.members?.members.length ?? 0);
    const isInteractive = Boolean(onClick);

    const handleCardClick = React.useCallback(() => {
        onClick?.(group);
    }, [group, onClick]);

    return (
        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardActionArea
                component={isInteractive ? 'button' : 'div'}
                disabled={!isInteractive}
                onClick={isInteractive ? handleCardClick : undefined}
                sx={{ flexGrow: 1, alignItems: 'flex-start' }}
            >
                <CardContent>
                    <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Typography variant="h6" sx={{ pr: 1 }} noWrap>
                                {group.name}
                            </Typography>
                            <Chip
                                label={formatGroupStatus(group.status)}
                                color={GROUP_STATUS_COLORS[group.status]}
                                size="small"
                                sx={{ textTransform: 'capitalize' }}
                            />
                        </Stack>

                        <Typography variant="body2" color="text.secondary" noWrap>
                            {thesis?.title || 'No thesis title yet'}
                        </Typography>

                        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Department
                                </Typography>
                                <Typography variant="body2">{group.department || '—'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Course
                                </Typography>
                                <Typography variant="body2">{group.course || '—'}</Typography>
                            </Box>
                        </Stack>

                        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Leader
                                </Typography>
                                <Typography variant="body2">{getUserDisplayName(leaderProfile)}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Members
                                </Typography>
                                <Typography variant="body2">{memberCount}</Typography>
                            </Box>
                        </Stack>

                        {footer ? (
                            <Box sx={{ pt: 1 }}>{footer}</Box>
                        ) : null}
                    </Stack>
                </CardContent>
            </CardActionArea>
            {actions ? (
                <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
                    {actions}
                </CardActions>
            ) : null}
        </Card>
    );
}

GroupCard.displayName = 'GroupCard';

/**
 * Minimal skeleton used while group card data is loading.
 * Mirrors the layout of `GroupCard` using MUI Skeletons so the grid keeps
 * consistent heights during async loads.
 */
export function GroupCardSkeleton() {
    return (
        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardActionArea sx={{ flexGrow: 1 }}>
                <CardContent>
                    <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Skeleton variant="text" width="60%" />
                            <Skeleton variant="rectangular" width={56} height={20} />
                        </Stack>

                        <Skeleton variant="text" width="80%" />

                        <Stack direction="row" spacing={2} flexWrap="wrap">
                            <Stack>
                                <Skeleton variant="text" width={100} />
                                <Skeleton variant="text" width={80} />
                            </Stack>
                            <Stack>
                                <Skeleton variant="text" width={100} />
                                <Skeleton variant="text" width={24} />
                            </Stack>
                        </Stack>
                    </Stack>
                </CardContent>
            </CardActionArea>
        </Card>
    );
}
