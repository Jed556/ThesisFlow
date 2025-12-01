import * as React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import type { ExpertRequest } from '../../types/expertRequest';
import type { ThesisGroup } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import { formatDateShort } from '../../utils/dateUtils';
import GroupCard from '../Group/GroupCard';

export interface ExpertRequestCardProps {
    request: ExpertRequest;
    group: ThesisGroup;
    requester: UserProfile | null;
    usersByUid: Map<string, UserProfile>;
    onOpenGroup?: (request: ExpertRequest) => void;
}

interface StatusDisplayConfig {
    label: string;
    color: 'success' | 'warning' | 'error' | 'default';
}

const STATUS_CONFIG: Record<ExpertRequest['status'], StatusDisplayConfig> = {
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

export function ExpertRequestCard({
    request,
    group,
    requester,
    usersByUid,
    onOpenGroup,
}: ExpertRequestCardProps) {
    const statusMeta = STATUS_CONFIG[request.status];
    const leaderName = resolveLeaderName(requester);
    const requestedDate = formatDateShort(request.createdAt);
    const respondedDate = request.respondedAt ? formatDateShort(request.respondedAt) : null;

    const handleOpenGroup = React.useCallback(() => {
        onOpenGroup?.(request);
    }, [onOpenGroup, request]);

    const canOpenGroup = Boolean(onOpenGroup);
    const handleGroupCardClick = React.useCallback((nextGroup: ThesisGroup) => {
        void nextGroup;
        handleOpenGroup();
    }, [handleOpenGroup]);
    const footer = (
        <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="body2">
                    Requested by <strong>{leaderName}</strong> on {requestedDate}
                </Typography>
                <Chip label={statusMeta.label} color={statusMeta.color} size="small" />
            </Stack>
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
    );

    return (
        <GroupCard
            group={group}
            usersByUid={usersByUid}
            onClick={canOpenGroup ? handleGroupCardClick : undefined}
            footer={footer}
        />
    );
}

export default ExpertRequestCard;
