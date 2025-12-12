import * as React from 'react';
import { Box, Card, CardActions, CardContent, Grid, Typography, Button } from '@mui/material';
import {
    WarningAmber as WarningAmberIcon,
    People as PeopleIcon,
    CalendarMonth as CalendarIcon,
    Event as EventIcon,
    Groups as GroupsIcon,
    Description as ThesisIcon,
    Folder as FileIcon,
    History as AuditIcon,
} from '@mui/icons-material';
import { AnimatedPage } from '../../../components/Animate';
import type { NavigationItem } from '../../../types/navigation';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import { getError } from '../../../../utils/errorUtils';
import { resolveAdminApiBaseUrl, buildAdminApiHeaders } from '../../../utils/firebase/api';
import { useBackgroundJobControls, useBackgroundJobFlag } from '../../../hooks/useBackgroundJobs';
import {
    WipeConfirmationDialog,
    type WipeCategory,
    type WipeScope,
} from '../../../components/WipeConfirmationDialog';
import { getAcademicYear } from '../../../utils/dateUtils';

export const metadata: NavigationItem = {
    group: 'management',
    index: 99,
    title: 'Danger Zone',
    segment: 'danger-zone',
    icon: <WarningAmberIcon />,
    roles: ['admin', 'developer'],
};

/**
 * Wipe action definitions with icons
 */
const wipeActions: (WipeCategory & { icon: React.ReactNode })[] = [
    {
        id: 'wipe-users',
        label: 'Wipe Users',
        description: 'Removes every user account from Firebase Auth and clears Firestore user documents at all hierarchy levels.',
        category: 'user',
        icon: <PeopleIcon />,
    },
    {
        id: 'wipe-calendars',
        label: 'Wipe Calendars',
        description: 'Deletes every calendar document and associated events at all hierarchy levels.',
        category: 'calendar',
        icon: <CalendarIcon />,
    },
    {
        id: 'wipe-events',
        label: 'Wipe Events',
        description: 'Deletes every event entry across all calendars while preserving calendar documents.',
        category: 'event',
        icon: <EventIcon />,
    },
    {
        id: 'wipe-groups',
        label: 'Wipe Groups',
        description: 'Removes all thesis groups with their subcollections: audits, expert requests, panel comments, proposals, and theses.',
        category: 'group',
        icon: <GroupsIcon />,
    },
    {
        id: 'wipe-theses',
        label: 'Wipe Theses',
        description: 'Deletes all thesis documents with stages, chapters, submissions, and chat history.',
        category: 'thesis',
        icon: <ThesisIcon />,
    },
    {
        id: 'wipe-files',
        label: 'Wipe Files',
        description: 'Clears all file data from Firestore (submissions, chats) and removes files from Firebase Storage.',
        category: 'file',
        icon: <FileIcon />,
    },
    {
        id: 'wipe-audits',
        label: 'Wipe Audits',
        description: 'Deletes all audit logs under groups and users at all hierarchy levels.',
        category: 'audit',
        icon: <AuditIcon />,
    },
];

/**
 * Sample departments and courses for scope filtering
 * In production, these should be fetched from Firestore
 */
const SAMPLE_DEPARTMENTS = [
    'Computer Science',
    'Information Technology',
    'Engineering',
    'Business',
];

const SAMPLE_DEPARTMENT_COURSES: Record<string, string[]> = {
    'Computer Science': ['BSCS', 'BSIT', 'BSIS'],
    'Information Technology': ['BSIT', 'BSIS'],
    'Engineering': ['BSCE', 'BSEE', 'BSME'],
    'Business': ['BSBA', 'BSMA', 'BSA'],
};

export default function DangerZonePage() {
    const { showNotification } = useSnackbar();
    const { startJob } = useBackgroundJobControls();

    // Dialog state
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [selectedAction, setSelectedAction] = React.useState<WipeCategory | null>(null);
    const [isWiping, setIsWiping] = React.useState(false);

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
     * Open confirmation dialog for a wipe action
     */
    const handleOpenDialog = React.useCallback((action: WipeCategory) => {
        setSelectedAction(action);
        setDialogOpen(true);
    }, []);

    /**
     * Close confirmation dialog
     */
    const handleCloseDialog = React.useCallback(() => {
        if (!isWiping) {
            setDialogOpen(false);
            setSelectedAction(null);
        }
    }, [isWiping]);

    /**
     * Execute a destructive wipe operation via the admin API.
     */
    const handleConfirmWipe = React.useCallback(async (scope: WipeScope) => {
        if (!selectedAction) return;

        setIsWiping(true);

        startJob(
            `Executing wipe: ${selectedAction.label}`,
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

                // Build request body with category and scope
                const body: Record<string, string> = {
                    category: selectedAction.category,
                };

                if (scope.year) {
                    body.year = scope.year;
                }
                if (scope.department) {
                    body.department = scope.department;
                }
                if (scope.course) {
                    body.course = scope.course;
                }

                const response = await fetch(`${apiUrl}/wipe`, {
                    method: 'DELETE',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                    signal,
                });

                if (!response.ok) {
                    const errorBody = await response.json().catch(() => null);
                    const message = errorBody?.error || `Failed to wipe ${selectedAction.label}`;
                    throw new Error(message);
                }

                const result = await response.json().catch(() => ({}));
                return result;
            },
            {
                jobType: 'danger-wipe',
                actionId: selectedAction.id,
                category: selectedAction.category,
                actionLabel: selectedAction.label,
                scope: scope,
            },
            (job) => {
                const actionLabel = (job.metadata?.actionLabel as string | undefined) || 'Operation';
                const jobScope = job.metadata?.scope as WipeScope | undefined;
                const scopeDesc = jobScope?.course
                    ? `${jobScope.department}/${jobScope.course}`
                    : jobScope?.department
                        ? jobScope.department
                        : 'all';

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
                        if (typeof result.authDeleted === 'number') {
                            detailParts.push(`Auth: ${result.authDeleted}`);
                        }
                        if (typeof result.storageDeleted === 'number') {
                            detailParts.push(`Storage: ${result.storageDeleted}`);
                        }
                        if (typeof result.authFailed === 'number' && result.authFailed > 0) {
                            detailParts.push(`Auth failures: ${result.authFailed}`);
                        }
                        if (typeof result.storageFailed === 'number' && result.storageFailed > 0) {
                            detailParts.push(`Storage failures: ${result.storageFailed}`);
                        }
                    }

                    const baseMessage =
                        (result && typeof result === 'object' && typeof result.message === 'string')
                            ? result.message
                            : `${actionLabel} completed successfully`;
                    const message = detailParts.length > 0
                        ? `${baseMessage} [${scopeDesc}] (${detailParts.join(', ')})`
                        : `${baseMessage} [${scopeDesc}]`;

                    showNotification(message, 'success');
                } else if (job.status === 'failed') {
                    const message = job.error || `Unable to complete ${actionLabel.toLowerCase()}`;
                    showNotification(message, 'error');
                }
            }
        );

        // Close dialog after starting the job
        setIsWiping(false);
        setDialogOpen(false);
        setSelectedAction(null);

        showNotification(
            'Wipe started in the background. You can navigate away and it will continue.',
            'warning',
            5000
        );
    }, [selectedAction, startJob, showNotification]);

    return (
        <AnimatedPage variant="fade">
            <Box>
                <Box mb={4}>
                    <Typography color="text.secondary">
                        These destructive actions permanently remove data. Use only in development or with extreme caution.
                        You can filter deletions by department or course to limit the scope.
                    </Typography>
                </Box>

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
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Box sx={{ color: 'warning.main' }}>
                                            {action.icon}
                                        </Box>
                                        <Typography variant="h6" color="warning.main" fontWeight={600}>
                                            {action.label}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {action.description}
                                    </Typography>
                                </CardContent>
                                <CardActions sx={{ mt: 'auto', px: 2, pb: 2 }}>
                                    <Button
                                        fullWidth
                                        color="warning"
                                        variant="contained"
                                        onClick={() => handleOpenDialog(action)}
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

            {/* Confirmation Dialog */}
            <WipeConfirmationDialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                action={selectedAction}
                onConfirm={handleConfirmWipe}
                isLoading={isWiping}
                departments={SAMPLE_DEPARTMENTS}
                departmentCourses={SAMPLE_DEPARTMENT_COURSES}
                currentYear={getAcademicYear()}
            />
        </AnimatedPage>
    );
}
