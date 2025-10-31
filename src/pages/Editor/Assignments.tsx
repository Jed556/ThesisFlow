import * as React from 'react';
import {
    Box,
    Card,
    CardContent,
    Chip,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import { AnimatedPage } from '../../components/Animate';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useSession } from '@toolpad/core';
import { getReviewerAssignments } from '../../data/reviewerWorkspace';
import type { ReviewerAssignment } from '../../types/reviewer';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 1,
    title: 'Editor Assignments',
    segment: 'editor/assignments',
    icon: <AssignmentTurnedInIcon />,
    roles: ['editor', 'admin'],
};

/**
 * Convert progress ratio to percentage string.
 */
function toPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

/**
 * Editor-facing grid that summarises all assigned theses.
 */
export default function EditorAssignmentsPage() {
    const session = useSession<Session>();
    // Ensure null is converted to undefined so the argument matches expected type
    const editorEmail: string | undefined = session?.user?.email ?? undefined;
    const assignments = React.useMemo(() => getReviewerAssignments('editor', editorEmail), [editorEmail]);

    const columns = React.useMemo<GridColDef<ReviewerAssignment>[]>(() => [
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
                    <LinearProgress variant="determinate" value={params.value * 100} sx={{ height: 8, borderRadius: 1 }} />
                    <Typography variant="caption" color="text.secondary">{toPercent(params.value)}</Typography>
                </Stack>
            ),
            sortComparator: (a, b) => a - b,
        },
        {
            field: 'dueDate',
            headerName: 'Next Due',
            flex: 0.8,
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
            flex: 0.6,
            renderCell: (params) => {
                const value = params.value as string;
                const palette: 'error' | 'warning' | 'default' = value === 'high' ? 'error' : value === 'medium' ? 'warning' : 'default';
                return <Chip label={value} color={palette} size="small" />;
            },
        },
    ], []);

    const rows = React.useMemo(() => assignments.map((assignment) => ({
        ...assignment,
        thesisTitle: assignment.thesisTitle,
        progress: assignment.progress,
        id: assignment.id,
    })), [assignments]);

    const totalInProgress = assignments.length;
    const completed = assignments.filter((assignment) => assignment.progress >= 0.99).length;

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Thesis assignments
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Track every manuscript under your editorial review and highlight those approaching deadlines.
                </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">Active reviews</Typography>
                        <Typography variant="h5">{totalInProgress}</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">Completed this term</Typography>
                        <Typography variant="h5">{completed}</Typography>
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
