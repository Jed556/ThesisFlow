import * as React from 'react';
import { Box, Button, Card, CardActions, CardContent, Grid, Stack, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { AnimatedPage } from '../../components/Animate';
import type { NavigationItem } from '../../types/navigation';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { getError } from '../../../utils/errorUtils';
import { resolveAdminApiBaseUrl, buildAdminApiHeaders } from '../../utils/firebase/api';
import { useBackgroundJobControls, useBackgroundJobFlag } from '../../hooks/useBackgroundJobs';

export const metadata: NavigationItem = {
    group: 'management',
    index: 99,
    title: 'Danger Zone',
    segment: 'danger-zone',
    icon: <WarningAmberIcon />,
    roles: ['admin', 'developer'],
};

type WipeCategory = 'calendar' | 'event' | 'file' | 'form' | 'group' | 'thesis' | 'user';

interface WipeAction {
    id: string;
    label: string;
    description: string;
    category: WipeCategory;
}

const wipeActions: WipeAction[] = [
    {
        id: 'wipe-auth-users',
        label: 'Wipe Auth + Firestore Users',
        description: 'Removes every user account from Firebase Auth and clears the users collection.',
        category: 'user',
    },
    {
        id: 'wipe-calendars',
        label: 'Wipe Calendars',
        description: 'Deletes every calendar document.',
        category: 'calendar',
    },
    {
        id: 'wipe-events',
        label: 'Wipe Events',
        description: 'Deletes every event entry across all calendars.',
        category: 'event',
    },
    {
        id: 'wipe-groups',
        label: 'Wipe Groups',
        description: 'Removes all thesis groups.',
        category: 'group',
    },
    {
        id: 'wipe-theses',
        label: 'Wipe Theses',
        description: 'Deletes every thesis document.',
        category: 'thesis',
    },
    {
        id: 'wipe-form-templates',
        label: 'Wipe Form Templates',
        description: 'Deletes every form template.',
        category: 'form',
    },
    {
        id: 'wipe-files',
        label: 'Wipe Files',
        description: 'Clears all file metadata documents.',
        category: 'file',
    },
];

export default function DangerZonePage() {
    const { showNotification } = useSnackbar();
    const { startJob } = useBackgroundJobControls();

    const hasActiveWipe = useBackgroundJobFlag(
        React.useCallback((job) => {
            if (job.status !== 'pending' && job.status !== 'running') {
                return false;
            }
            const jobType = job.metadata?.jobType as string | undefined;
            return jobType === 'danger-wipe';
        }, [])
    );

    /**
     * Execute a destructive wipe operation via the admin API.
     */
    const handleWipe = React.useCallback(async (action: WipeAction) => {
        if (!window.confirm(`This will permanently delete data for "${action.label}". Continue?`)) {
            return;
        }

        startJob(
            `Executing wipe: ${action.label}`,
            async (_, signal) => {
                const apiUrl = resolveAdminApiBaseUrl();

                let headers: Record<string, string>;
                try {
                    headers = await buildAdminApiHeaders();
                } catch (authError) {
                    const { message } = getError(
                        authError,
                        'Authentication required to execute wipe operations.'
                    );
                    throw new Error(message);
                }

                if (signal.aborted) {
                    throw new Error('Wipe cancelled');
                }

                const response = await fetch(`${apiUrl}/wipe`, {
                    method: 'DELETE',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ category: action.category }),
                    signal,
                });

                if (!response.ok) {
                    const errorBody = await response.json().catch(() => null);
                    const message = errorBody?.error || `Failed to wipe ${action.label}`;
                    throw new Error(message);
                }

                const result = await response.json().catch(() => ({}));
                return result;
            },
            {
                jobType: 'danger-wipe',
                actionId: action.id,
                category: action.category,
                actionLabel: action.label,
            },
            (job) => {
                const actionLabel = (job.metadata?.actionLabel as string | undefined) || 'Operation';

                if (job.status === 'completed') {
                    const result = job.result as Record<string, unknown> | null;
                    const detailParts: string[] = [];
                    if (result && typeof result === 'object') {
                        if (typeof result.deleted === 'number') {
                            detailParts.push(`Deleted: ${result.deleted}`);
                        }
                        if (typeof result.batches === 'number') {
                            detailParts.push(`Batches: ${result.batches}`);
                        }
                        if (typeof result.firestoreDeleted === 'number') {
                            detailParts.push(`Firestore: ${result.firestoreDeleted}`);
                        }
                        if (typeof result.firestoreBatches === 'number') {
                            detailParts.push(`Firestore batches: ${result.firestoreBatches}`);
                        }
                        if (typeof result.authDeleted === 'number') {
                            detailParts.push(`Auth: ${result.authDeleted}`);
                        }
                        if (typeof result.authFailed === 'number' && result.authFailed > 0) {
                            detailParts.push(`Auth failures: ${result.authFailed}`);
                        }
                    }

                    const baseMessage =
                        (result && typeof result === 'object' && typeof result.message === 'string')
                            ? result.message
                            : `${actionLabel} completed successfully`;
                    const message = detailParts.length > 0
                        ? `${baseMessage} (${detailParts.join(', ')})`
                        : baseMessage;

                    showNotification(message, 'success');
                } else if (job.status === 'failed') {
                    const message = job.error || `Unable to complete ${actionLabel.toLowerCase()}`;
                    showNotification(message, 'error');
                }
            }
        );

        showNotification(
            'Wipe started in the background. You can navigate away and it will continue.',
            'warning',
            5000
        );
    }, [startJob, showNotification]);

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ py: 6 }}>
                <Stack direction="row" alignItems="center" spacing={2} mb={4}>
                    <WarningAmberIcon color="warning" sx={{ fontSize: 32 }} />
                    <Box>
                        <Typography variant="h4" fontWeight={600} color="warning.main">
                            Danger Zone
                        </Typography>
                        <Typography color="text.secondary">
                            These destructive actions permanently remove data. Use only in development or with extreme caution.
                        </Typography>
                    </Box>
                </Stack>

                <Grid container spacing={3}>
                    {wipeActions.map(action => (
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={action.id}>
                            <Card
                                variant="outlined"
                                sx={{
                                    borderColor: 'warning.light',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    bgcolor: 'background.default',
                                }}
                            >
                                <CardContent>
                                    <Typography variant="h6" color="warning.main" fontWeight={600} gutterBottom>
                                        {action.label}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {action.description}
                                    </Typography>
                                </CardContent>
                                <CardActions sx={{ mt: 'auto', px: 2, pb: 2 }}>
                                    <Button
                                        fullWidth
                                        color="warning"
                                        variant="contained"
                                        onClick={() => handleWipe(action)}
                                        disabled={hasActiveWipe}
                                    >
                                        {hasActiveWipe ? 'Wiping…' : 'Execute Wipe'}
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </AnimatedPage>
    );
}
