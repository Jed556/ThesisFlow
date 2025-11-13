import * as React from 'react';
import {
    Box, Button, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, Stack, Typography,
} from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import type { ThesisGroup } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import { formatGroupStatus, GROUP_STATUS_COLORS } from './constants';
import { GrowTransition } from '../Animate';

interface GroupViewProps {
    open: boolean;
    group: ThesisGroup | null;
    usersByEmail: Map<string, UserProfile>;
    onClose: () => void;
    onEdit?: (group: ThesisGroup) => void;
    onDelete?: (group: ThesisGroup) => void;
    canManage?: boolean;
}

const getProfileLabel = (profile?: UserProfile): string => {
    if (!profile) {
        return '—';
    }
    const first = profile.name?.first?.trim();
    const last = profile.name?.last?.trim();
    const fullName = [first, last].filter(Boolean).join(' ');
    return fullName ? `${fullName} (${profile.email})` : profile.email;
};

/**
 * Presents a full group summary inside a dialog, including membership and
 * metadata. Management actions are selectively exposed to privileged roles.
 */
export const GroupView: React.FC<GroupViewProps> = ({
    open,
    group,
    usersByEmail,
    onClose,
    onEdit,
    onDelete,
    canManage,
}) => {
    const leaderProfile = group ? usersByEmail.get(group.members.leader) : undefined;
    const adviserProfile = group?.members.adviser ? usersByEmail.get(group.members.adviser) : undefined;
    const editorProfile = group?.members.editor ? usersByEmail.get(group.members.editor) : undefined;
    const memberLabels = React.useMemo(() => {
        if (!group) {
            return [] as { email: string; label: string }[];
        }
        return group.members.members.map((memberEmail) => ({
            email: memberEmail,
            label: getProfileLabel(usersByEmail.get(memberEmail)),
        }));
    }, [group, usersByEmail]);

    const handleEdit = React.useCallback(() => {
        if (group) {
            onEdit?.(group);
        }
    }, [group, onEdit]);

    const handleDelete = React.useCallback(() => {
        if (group) {
            onDelete?.(group);
        }
    }, [group, onDelete]);

    const updatedAtLabel = group?.updatedAt ? new Date(group.updatedAt).toLocaleString() : '—';

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" slots={{ transition: GrowTransition }}>
            <DialogTitle>{group?.name ?? 'Group Details'}</DialogTitle>
            <DialogContent dividers>
                {group ? (
                    <Stack spacing={3}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                                label={formatGroupStatus(group.status)}
                                color={GROUP_STATUS_COLORS[group.status]}
                                size="small"
                                sx={{ textTransform: 'capitalize' }}
                            />
                            <Typography variant="body2" color="text.secondary">
                                Updated {updatedAtLabel}
                            </Typography>
                        </Stack>

                        <Stack spacing={1.5}>
                            <Typography variant="h6">Overview</Typography>
                            <Stack spacing={1}>
                                <Typography>
                                    <strong>Thesis Title:</strong> {group.thesisTitle || '—'}
                                </Typography>
                                <Typography>
                                    <strong>Department:</strong> {group.department || '—'}
                                </Typography>
                                <Typography>
                                    <strong>Course:</strong> {group.course || '—'}
                                </Typography>
                                <Typography>
                                    <strong>Description:</strong> {group.description || '—'}
                                </Typography>
                            </Stack>
                        </Stack>

                        <Divider />

                        <Stack spacing={1.5}>
                            <Typography variant="h6">Team</Typography>
                            <Stack spacing={1}>
                                <Typography>
                                    <strong>Leader:</strong> {getProfileLabel(leaderProfile)}
                                </Typography>
                                <Typography>
                                    <strong>Adviser:</strong> {getProfileLabel(adviserProfile)}
                                </Typography>
                                <Typography>
                                    <strong>Editor:</strong> {getProfileLabel(editorProfile)}
                                </Typography>
                                <Box>
                                    <Typography sx={{ mb: 1 }}>
                                        <strong>Members:</strong>
                                    </Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {memberLabels.length > 0 ? (
                                            memberLabels.map((member) => (
                                                <Chip key={member.email} label={member.label} size="small" sx={{ mb: 1 }} />
                                            ))
                                        ) : (
                                            <Typography color="text.secondary">No members listed</Typography>
                                        )}
                                    </Stack>
                                </Box>
                            </Stack>
                        </Stack>
                    </Stack>
                ) : (
                    <Typography color="text.secondary">Group information is unavailable.</Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                {canManage && group && (
                    <>
                        <Button onClick={handleEdit} color="primary">
                            Edit
                        </Button>
                        <Button onClick={handleDelete} color="error" variant="contained">
                            Delete
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

/**
 * Skeleton placeholder for the GroupView dialog while data loads.
 */
export function GroupViewSkeleton({ open = true }: { open?: boolean }) {
    const titleWidth = 240;
    return (
        <Dialog open={open} fullWidth maxWidth="md" slots={{ transition: GrowTransition }}>
            <DialogTitle>
                <Skeleton variant="text" width={titleWidth} />
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Skeleton variant="rectangular" width={96} height={24} />
                        <Skeleton variant="text" width={120} />
                    </Stack>

                    <Stack spacing={1.5}>
                        <Typography variant="h6"><Skeleton width={120} /></Typography>
                        <Stack spacing={1}>
                            <Skeleton variant="text" width="100%" />
                            <Skeleton variant="text" width="80%" />
                            <Skeleton variant="text" width="60%" />
                        </Stack>
                    </Stack>

                    <Divider />

                    <Stack spacing={1.5}>
                        <Typography variant="h6"><Skeleton width={120} /></Typography>
                        <Stack spacing={1}>
                            <Skeleton variant="text" width="50%" />
                            <Skeleton variant="text" width="40%" />
                            <Stack direction="row" spacing={1}>
                                <Skeleton variant="circular" width={24} height={24} />
                                <Skeleton variant="circular" width={24} height={24} />
                                <Skeleton variant="circular" width={24} height={24} />
                            </Stack>
                        </Stack>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Skeleton variant="rectangular" width={80} height={36} />
                <Skeleton variant="rectangular" width={100} height={36} />
            </DialogActions>
        </Dialog>
    );
}
