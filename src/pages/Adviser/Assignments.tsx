import * as React from 'react';
import { Alert, Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { ReviewerAssignment } from '../../types/reviewer';
import type { Session } from '../../types/session';
import { AnimatedPage } from '../../components/Animate';
import { listenReviewerAssignmentsForUser } from '../../utils/firebase/firestore/thesis';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 4,
    title: 'Assignments',
    segment: 'adviser-assignments',
    icon: <FactCheckIcon />,
    roles: ['adviser'],
};

function toPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

export default function AdviserAssignmentsPage() {
    const session = useSession<Session>();
    const adviserUid = session?.user?.uid;
    const [assignments, setAssignments] = React.useState<ReviewerAssignment[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!adviserUid) {
            setAssignments([]);
            setLoading(false);
            setError(null);
            return () => { /* no-op */ };
        }

        setLoading(true);
        const unsubscribe = listenReviewerAssignmentsForUser('adviser', adviserUid, {
            onData: (data) => {
                setAssignments(data);
                setLoading(false);
                setError(null);
            },
            onError: (listenerError) => {
                console.error('Failed to load adviser assignments:', listenerError);
                setError('Unable to load assignments. Please try again or refresh the page.');
                setLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [adviserUid]);

    const columns = React.useMemo<GridColDef<ReviewerAssignment>[]>(
        () => [
            {
                field: 'thesisTitle',
                headerName: 'Thesis',
                flex: 1.4,
            },
            {
                field: 'stage',
                headerName: 'Stage',
                flex: 0.9,
                renderCell: (params) => <Chip label={params.value} size="small" />,
            },
            {
                field: 'progress',
                headerName: 'Progress',
                flex: 1.1,
                renderCell: (params) => (
                    <Stack spacing={0.5} sx={{ width: '100%' }}>
                        <LinearProgress
                            variant="determinate"
                            value={params.value * 100}
                            sx={{ height: 8, borderRadius: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            {toPercent(params.value)}
                        </Typography>
                    </Stack>
                ),
                sortComparator: (a, b) => a - b,
            },
            {
                field: 'dueDate',
                headerName: 'Next Milestone',
                flex: 0.95,
                valueFormatter: ({ value }) => value ?? '—',
            },
            {
                field: 'studentEmails',
                headerName: 'Students',
                flex: 1.2,
                renderCell: (params) => {
                    const emails: string[] = Array.isArray(params.value) ? params.value : [];
                    return (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {emails.map((email) => (
                                <Chip key={email} label={email.split('@')[0]} size="small" variant="outlined" />
                            ))}
                        </Stack>
                    );
                },
            },
            {
                field: 'priority',
                headerName: 'Priority',
                flex: 0.65,
                renderCell: (params) => {
                    const value = params.value as string;
                    const palette: 'error' | 'warning' | 'default' =
                        value === 'high' ? 'error' : value === 'medium' ? 'warning' : 'default';
                    return <Chip label={value} color={palette} size="small" />;
                },
            },
        ],
        [],
    );

    const rows = React.useMemo(
        () => assignments.map((assignment) => ({
            ...assignment,
            progress: assignment.progress,
            id: assignment.id,
        })),
        [assignments],
    );

    const activeCount = assignments.length;
    const onTrack = assignments.filter((assignment) => assignment.progress >= 0.75).length;

    return (
        <AnimatedPage variant="slideUp">
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Advising workload
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Stay ahead of advisee deliverables and coordinate feedback with assigned editors.
                </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                            Active theses
                        </Typography>
                        <Typography variant="h5">{activeCount}</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                            On track (≥ 75%)
                        </Typography>
                        <Typography variant="h5">{onTrack}</Typography>
                    </CardContent>
                </Card>
            </Stack>

            <Box sx={{ height: 520 }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    disableRowSelectionOnClick
                    sx={{ borderRadius: 2, border: 'none' }}
                    getRowHeight={() => 'auto'}
                    loading={loading}
                    initialState={{
                        sorting: { sortModel: [{ field: 'dueDate', sort: 'asc' }] },
                        pagination: { paginationModel: { pageSize: 7 } },
                    }}
                    pageSizeOptions={[5, 7, 10]}
                />
            </Box>
        </AnimatedPage>
    );
}
