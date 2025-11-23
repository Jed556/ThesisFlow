import * as React from 'react';
import { Card, CardActionArea, CardActions, CardContent, Chip, Stack, Typography, Button, Box } from '@mui/material';
import { Group as GroupIcon, CheckCircle as ApproveIcon, Close as RejectIcon } from '@mui/icons-material';
import type { MentorRequest } from '../../types/mentorRequest';
import type { ThesisGroup } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import { formatDateShort } from '../../utils/dateUtils';

interface MentorRequestCardProps {
    request: MentorRequest;
    group: ThesisGroup | null;
    requester: UserProfile | null;
    onApprove?: (request: MentorRequest) => void;
    onReject?: (request: MentorRequest) => void;
    onOpenGroup?: (groupId: string) => void;
}

interface StatusDisplayConfig {
    label: string;
    color: 'success' | 'warning' | 'error' | 'default';
}

const STATUS_CONFIG: Record<MentorRequest['status'], StatusDisplayConfig> = {
    pending: { label: 'Pending', color: 'warning' },
    approved: { label: 'Approved', color: 'success' },
    rejected: { label: 'Rejected', color: 'error' },
};

function resolveLeaderName(requester: UserProfile | null): string {
    if (!requester) {
        return 'Unknown student';
    }

    const first = requester.name?.first?.trim();
    const last = requester.name?.last?.trim();
    const fallback = requester.email ?? requester.uid;

    const full = [first, last].filter(Boolean).join(' ');
    return full || fallback;
}

export function MentorRequestCard({ request, group, requester, onApprove, onReject, onOpenGroup, }: MentorRequestCardProps) {
    const statusMeta = STATUS_CONFIG[request.status];
    const leaderName = resolveLeaderName(requester);
    const requestedDate = formatDateShort(request.createdAt);
    const respondedDate = request.respondedAt ? formatDateShort(request.respondedAt) : null;

    const handleOpenGroup = React.useCallback(() => {
        if (!onOpenGroup) {
            return;
        }
        onOpenGroup(request.groupId);
    }, [onOpenGroup, request.groupId]);

    const handleApprove = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!onApprove) {
            return;
        }
        onApprove(request);
    }, [onApprove, request]);

    const handleReject = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!onReject) {
            return;
        }
        onReject(request);
    }, [onReject, request]);

    const canOpenGroup = Boolean(onOpenGroup);

    return (
        <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <CardActionArea
                disabled={!canOpenGroup}
                onClick={handleOpenGroup}
                sx={{ flexGrow: 1, alignItems: 'flex-start' }}
            >
                <CardContent sx={{ width: '100%' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">
                                Group
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <GroupIcon fontSize="small" />
                                <Typography variant="h6">
                                    {group?.name ?? 'Unknown group'}
                                </Typography>
                            </Stack>
                            {group?.course && (
                                <Typography variant="body2" color="text.secondary">
                                    Course: {group.course}
                                </Typography>
                            )}
                            {group?.department && (
                                <Typography variant="body2" color="text.secondary">
                                    Department: {group.department}
                                </Typography>
                            )}
                        </Box>
                        <Chip label={statusMeta.label} color={statusMeta.color} size="small" />
                    </Stack>

                    <Stack spacing={0.5} sx={{ mt: 2 }}>
                        <Typography variant="body2">
                            Requested by <strong>{leaderName}</strong> on {requestedDate}
                        </Typography>
                        {request.message && (
                            <Typography variant="body2" color="text.secondary">
                                “{request.message}”
                            </Typography>
                        )}
                        {respondedDate && (
                            <Typography variant="body2" color="text.secondary">
                                Responded on {respondedDate}
                            </Typography>
                        )}
                        {request.responseNote && (
                            <Typography variant="body2" color="text.secondary">
                                Note: {request.responseNote}
                            </Typography>
                        )}
                    </Stack>
                </CardContent>
            </CardActionArea>
            {request.status === 'pending' && (
                <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Stack direction="row" spacing={1}>
                        <Button
                            startIcon={<ApproveIcon />}
                            color="success"
                            variant="contained"
                            onClick={handleApprove}
                        >
                            Approve
                        </Button>
                        <Button
                            startIcon={<RejectIcon />}
                            color="error"
                            variant="outlined"
                            onClick={handleReject}
                        >
                            Reject
                        </Button>
                    </Stack>
                </CardActions>
            )}
        </Card>
    );
}

export default MentorRequestCard;
