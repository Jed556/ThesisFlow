import * as React from 'react';
import {
    Card, CardActionArea, CardActions, CardContent, Chip,
    IconButton, Stack, Tooltip, Typography, Box,
} from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { ThesisGroup } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import { GROUP_STATUS_COLORS, formatGroupStatus } from './constants';

interface GroupCardProps {
    group: ThesisGroup;
    usersByEmail: Map<string, UserProfile>;
    onClick?: (group: ThesisGroup) => void;
    onEdit?: (group: ThesisGroup) => void;
    onDelete?: (group: ThesisGroup) => void;
    canManage?: boolean;
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
 * Displays a thesis group summary inside a clickable card. The card exposes edit
 * and delete affordances for privileged users while keeping the entire surface
 * tappable to open the detailed group view.
 */
export default function GroupCard({ group, usersByEmail, onClick, onEdit, onDelete, canManage }: GroupCardProps) {
    const leaderProfile = usersByEmail.get(group.leader);
    const memberCount = group.members?.length ?? 0;

    const handleCardClick = React.useCallback(() => {
        onClick?.(group);
    }, [group, onClick]);

    const handleEditClick = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onEdit?.(group);
        },
        [group, onEdit]
    );

    const handleDeleteClick = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onDelete?.(group);
        },
        [group, onDelete]
    );

    return (
        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardActionArea onClick={handleCardClick} sx={{ flexGrow: 1 }}>
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
                            {group.thesisTitle || 'No thesis title yet'}
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
                    </Stack>
                </CardContent>
            </CardActionArea>
            {canManage && (
                <CardActions sx={{ justifyContent: 'flex-end', pt: 0, pb: 2, pr: 2 }}>
                    <Tooltip title="Edit group">
                        <IconButton color="primary" size="small" onClick={handleEditClick}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete group">
                        <IconButton color="error" size="small" onClick={handleDeleteClick}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </CardActions>
            )}
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
            <CardActions sx={{ justifyContent: 'flex-end', pt: 0, pb: 2, pr: 2 }}>
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton variant="circular" width={32} height={32} />
            </CardActions>
        </Card>
    );
}
