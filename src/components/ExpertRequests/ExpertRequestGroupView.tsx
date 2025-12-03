import * as React from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import type { ExpertRequest, ExpertRequestRole } from '../../types/expertRequest';
import type { Session } from '../../types/session';
import ExpertRequestDecisionActions from './ExpertRequestDecisionActions';
import GroupView from '../Group/GroupView';
import type { ThesisGroup } from '../../types/group';
import UnauthorizedNotice from '../../layouts/UnauthorizedNotice';
import { AnimatedPage } from '../Animate';
import { getPendingExpertRequestByGroup } from '../../utils/firebase/firestore/expertRequests';

interface ExpertRequestRouteState {
    expertRequest?: ExpertRequest;
}

export interface ExpertRequestGroupViewProps {
    groupId: string;
    role: ExpertRequestRole;
    roleLabel: string;
    hint?: string;
}

/**
 * Shared service request group view that injects decision buttons beside the back button.
 */
export default function ExpertRequestGroupView({ groupId, role, roleLabel, hint }: ExpertRequestGroupViewProps) {
    const session = useSession<Session>();
    const viewerRole = session?.user?.role;
    const expertUid = session?.user?.uid ?? null;
    const navigate = useNavigate();
    const location = useLocation();

    const routeState = location.state as ExpertRequestRouteState | null;
    const routeRequest = routeState?.expertRequest ?? null;

    const [request, setRequest] = React.useState<ExpertRequest | null>(routeRequest);
    const [requestLoading, setRequestLoading] = React.useState(!routeRequest);
    const [requestError, setRequestError] = React.useState<string | null>(null);

    const validRole = viewerRole === role;

    const handleBack = React.useCallback(() => {
        navigate(-1);
    }, [navigate]);

    React.useEffect(() => {
        let ignore = false;
        if (!groupId || !expertUid) {
            setRequest(routeRequest);
            setRequestLoading(false);
            return () => { ignore = true; };
        }

        if (routeRequest && routeRequest.status === 'pending') {
            setRequest(routeRequest);
            setRequestLoading(false);
            setRequestError(null);
            return () => { ignore = true; };
        }

        setRequestLoading(true);
        setRequestError(null);
        void getPendingExpertRequestByGroup(groupId, expertUid, role)
            .then((record: ExpertRequest | null) => {
                if (ignore) {
                    return;
                }
                setRequest(record);
                if (!record) {
                    setRequestError('No pending request for this group.');
                }
            })
            .catch((error: Error) => {
                if (ignore) {
                    return;
                }
                console.error('Failed to fetch pending service request:', error);
                setRequest(null);
                setRequestError('Unable to load the request for this group.');
            })
            .finally(() => {
                if (!ignore) {
                    setRequestLoading(false);
                }
            });

        return () => {
            ignore = true;
        };
    }, [groupId, expertUid, role, routeRequest]);

    const handleDecisionComplete = React.useCallback((status: 'approved' | 'rejected') => {
        setRequest((prev) => (prev ? { ...prev, status } : prev));
    }, []);

    const renderHeaderActions = React.useCallback((context: { group: ThesisGroup | null; loading: boolean; }) => (
        <>
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack}>
                Back
            </Button>
            <ExpertRequestDecisionActions
                request={request}
                group={context.group}
                role={role}
                roleLabel={roleLabel}
                expertUid={expertUid}
                loading={context.loading || requestLoading}
                onCompleted={handleDecisionComplete}
            />
        </>
    ), [handleBack, handleDecisionComplete, expertUid, request, requestLoading, role, roleLabel]);

    if (!session || session.loading) {
        return (
            <AnimatedPage variant="fade">
                <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary">
                        Loading group details…
                    </Typography>
                </Stack>
            </AnimatedPage>
        );
    }

    if (!validRole) {
        return (
            <UnauthorizedNotice
                variant="box"
                title="Expert access only"
                description={`Only ${roleLabel.toLowerCase()}s can view this page.`}
            />
        );
    }

    if (!expertUid) {
        return (
            <AnimatedPage variant="fade">
                <Alert severity="warning">
                    You need to sign in again to review service requests.
                </Alert>
            </AnimatedPage>
        );
    }

    if (!groupId) {
        return (
            <AnimatedPage variant="fade">
                <Alert severity="error">Group ID is missing.</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="fade">
            <Stack spacing={2} sx={{ mb: 2 }}>
                {requestError && !requestLoading ? (
                    <Alert severity="info" onClose={() => setRequestError(null)}>
                        {requestError}
                    </Alert>
                ) : null}
                {requestLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">
                            Loading pending request…
                        </Typography>
                    </Box>
                )}
            </Stack>
            <GroupView
                groupId={groupId}
                headerActions={({ group, loading }) => renderHeaderActions({ group, loading })}
                hint={hint}
            />
        </AnimatedPage>
    );
}
