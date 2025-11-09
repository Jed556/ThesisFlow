import { useState } from 'react';
import { Box, Button, Card, CardActions, CardContent, Grid, Stack, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { AnimatedPage } from '../../components/Animate';
import type { NavigationItem } from '../../types/navigation';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { getError } from '../../../utils/errorUtils';
import { resolveAdminApiBaseUrl, buildAdminApiHeaders } from '../../utils/firebase/api';

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
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    /**
     * Execute a destructive wipe operation via the admin API.
     */
    const handleWipe = async (action: WipeAction) => {
        if (!window.confirm(`This will permanently delete data for "${action.label}". Continue?`)) {
            return;
        }

        setLoadingAction(action.id);

        try {
            const apiUrl = resolveAdminApiBaseUrl();
            let headers: Record<string, string>;

            try {
                headers = await buildAdminApiHeaders();
            } catch (authError) {
                const { message } = getError(authError, 'Authentication required to execute wipe operations.');
                showNotification(message, 'error');
                return;
            }

            const response = await fetch(`${apiUrl}/wipe`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ category: action.category }),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => null);
                const message = errorBody?.error || `Failed to wipe ${action.label}`;
                throw new Error(message);
            }

            const result = await response.json();

            const detailParts: string[] = [];
            if (typeof result === 'object' && result) {
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

            const baseMessage = result?.message || `${action.label} wiped successfully`;
            const message = detailParts.length > 0 ? `${baseMessage} (${detailParts.join(', ')})` : baseMessage;

            showNotification(message, 'success');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : `Unable to wipe ${action.label}`;
            showNotification(message, 'error');
        } finally {
            setLoadingAction(null);
        }
    };

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
                                        disabled={loadingAction === action.id}
                                    >
                                        {loadingAction === action.id ? 'Wiping…' : 'Execute Wipe'}
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
