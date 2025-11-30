import * as React from 'react';
import { Button, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisGroup } from '../../types/group';
import type { Session } from '../../types/session';
import { AnimatedPage } from '../../components/Animate';
import GroupView, { type GroupViewHeaderContext } from '../../components/Group/GroupView';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { cancelJoinRequest, requestToJoinGroup } from '../../utils/groupUtils';

export const metadata: NavigationItem = {
    title: 'Group Details',
    segment: 'group/:groupId',
    roles: ['student'],
    hidden: true,
};

export default function StudentGroupViewPage() {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const session = useSession<Session>();
    const userUid = session?.user?.uid;
    const { showNotification } = useSnackbar();
    const [actionLoading, setActionLoading] = React.useState(false);
    const [refreshToken, setRefreshToken] = React.useState(0);

    const handleBack = React.useCallback(() => {
        navigate(-1);
    }, [navigate]);

    const handleToggleRequest = React.useCallback(async (group: ThesisGroup, hasRequest: boolean) => {
        if (!group?.id || !userUid) {
            showNotification('Sign in to send requests.', 'info');
            return;
        }
        setActionLoading(true);
        try {
            if (hasRequest) {
                await cancelJoinRequest(group.id, userUid);
                showNotification('Join request cancelled.', 'success');
            } else {
                await requestToJoinGroup(group.id, userUid);
                showNotification('Join request sent.', 'success');
            }
            setRefreshToken((token) => token + 1);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update request.';
            showNotification(message, 'error');
        } finally {
            setActionLoading(false);
        }
    }, [showNotification, userUid]);

    const renderHeaderActions = React.useCallback(({ group, invites, requests, loading }: GroupViewHeaderContext) => {
        const buttons: React.ReactNode[] = [
            <Button key="back" variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack}>
                Back
            </Button>,
        ];

        if (group && userUid) {
            const isLeader = group.members.leader === userUid;
            const isMember = group.members.members.includes(userUid);
            const hasInvite = invites.includes(userUid);
            const hasRequest = requests.includes(userUid);
            const allowedStatuses: ThesisGroup['status'][] = ['draft', 'review'];
            const statusAllowsRequest = allowedStatuses.includes(group.status);
            const canRequest = !isLeader && !isMember && !hasInvite && statusAllowsRequest;
            const buttonDisabled = (!hasRequest && !canRequest) || actionLoading || loading;

            if (!isLeader && !isMember && !hasInvite) {
                buttons.push(
                    <Button
                        key="request"
                        variant={hasRequest ? 'outlined' : 'contained'}
                        color={hasRequest ? 'inherit' : 'primary'}
                        disabled={buttonDisabled}
                        onClick={() => handleToggleRequest(group, hasRequest)}
                    >
                        {hasRequest ? 'Cancel request' : 'Request to join'}
                    </Button>,
                );
            }
        }

        return (
            <Stack direction="row" spacing={1} flexWrap="wrap">
                {buttons}
            </Stack>
        );
    }, [actionLoading, handleBack, handleToggleRequest, userUid]);

    return (
        <AnimatedPage variant="fade">
            <GroupView
                groupId={groupId ?? ''}
                refreshToken={refreshToken}
                headerActions={renderHeaderActions}
                hint="This page shows your selected thesis group."
            />
        </AnimatedPage>
    );
}
