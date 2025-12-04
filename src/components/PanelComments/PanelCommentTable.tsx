import * as React from 'react';
import {
    Alert, Box, Button, Chip, Paper, Stack, TextField, Typography
} from '@mui/material';
import {
    DataGrid as MuiDataGrid, GridActionsCellItem,
    type GridColDef, type GridRenderCellParams, type GridRowParams,
} from '@mui/x-data-grid';
import {
    Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
    CheckCircle as ApproveIcon, Replay as RevisionIcon, RateReview as RequestReviewIcon
} from '@mui/icons-material';
import type { PanelCommentApprovalStatus, PanelCommentEntry } from '../../types/panelComment';
import { formatRelative, normalizeDateInput } from '../../utils/dateUtils';

export type PanelCommentTableVariant = 'student' | 'panel' | 'admin';

export interface PanelCommentTableProps {
    title?: string;
    entries: PanelCommentEntry[];
    variant: PanelCommentTableVariant;
    loading?: boolean;
    disabled?: boolean;
    /** Whether the table has been released to students (disables edit/delete for panel) */
    released?: boolean;
    busyEntryIds?: Set<string>;
    emptyState?: React.ReactNode;
    onAddEntry?: () => void;
    onEditEntry?: (entry: PanelCommentEntry) => void;
    onDeleteEntry?: (entry: PanelCommentEntry) => void;
    onStudentFieldChange?: (
        entry: PanelCommentEntry,
        field: 'studentPage' | 'studentStatus',
        value: string,
    ) => void;
    /** Callback for panel to set approval status on an entry */
    onApprovalChange?: (entry: PanelCommentEntry, status: PanelCommentApprovalStatus) => void;
    /** Callback for student to request review after making revisions */
    onRequestReview?: (entry: PanelCommentEntry) => void;
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(value?: string): string {
    const date = normalizeDateInput(value);
    if (!date) {
        return '—';
    }
    return formatRelative(date, { style: 'short' }, new Date());
}

/**
 * Get chip props for approval status display.
 */
function getApprovalChipProps(status: PanelCommentApprovalStatus | undefined): {
    label: string;
    color: 'default' | 'success' | 'warning' | 'info';
} {
    switch (status) {
        case 'approved':
            return { label: 'Approved', color: 'success' };
        case 'revision_required':
            return { label: 'Revision Required', color: 'warning' };
        case 'review_requested':
            return { label: 'Review Requested', color: 'info' };
        default:
            return { label: 'Pending', color: 'default' };
    }
}

/**
 * Row type for the DataGrid (extends PanelCommentEntry with required id field).
 */
type PanelCommentRow = PanelCommentEntry & { rowNumber: number };

/**
 * Shared DataGrid-based table component for displaying panel comment entries
 * across student, panel, and admin views.
 */
export function PanelCommentTable({
    title = 'Panel comment sheet',
    entries,
    variant,
    loading = false,
    disabled = false,
    released = false,
    busyEntryIds,
    emptyState,
    onAddEntry,
    onEditEntry,
    onDeleteEntry,
    onStudentFieldChange,
    onApprovalChange,
    onRequestReview,
}: PanelCommentTableProps) {
    // Show student columns for student/admin views, or for panel when table is released (for review)
    const showStudentColumns = variant !== 'panel' || released;
    const allowStudentEdit = variant === 'student' && Boolean(onStudentFieldChange);
    // Panel can only edit/delete if table is NOT released to students
    const canPanelEdit = variant === 'panel' && !released;
    // Show approval column for student, panel (after release) and admin views
    const showApprovalColumn = variant === 'student' || (variant === 'panel' && released) || variant === 'admin';
    // Panel can set approval status only after table is released
    const canSetApproval = variant === 'panel' && released && Boolean(onApprovalChange);
    // Student can request review when status is revision_required
    const canRequestReview = variant === 'student' && Boolean(onRequestReview);
    // Show actions column for panel or student (when can request review)
    const showActions = (variant === 'panel' && (!!onEditEntry || !!onDeleteEntry || !!onApprovalChange)) || canRequestReview;

    // Local state for student field edits (controlled inputs)
    const [editingFields, setEditingFields] = React.useState<
        Record<string, { studentPage?: string; studentStatus?: string }>
    >({});

    /**
     * Handle student field blur - save changes.
     */
    const handleStudentBlur = React.useCallback((
        entry: PanelCommentEntry,
        field: 'studentPage' | 'studentStatus',
    ) => {
        if (!onStudentFieldChange) return;

        const editedValue = editingFields[entry.id]?.[field];
        if (editedValue === undefined) return;

        const currentValue = (field === 'studentPage' ? entry.studentPage : entry.studentStatus) ?? '';
        if (editedValue.trim() === currentValue.trim()) {
            // No change, clear editing state
            setEditingFields((prev) => {
                const next = { ...prev };
                if (next[entry.id]) {
                    delete next[entry.id][field];
                    if (Object.keys(next[entry.id]).length === 0) {
                        delete next[entry.id];
                    }
                }
                return next;
            });
            return;
        }

        onStudentFieldChange(entry, field, editedValue.trim());
        // Clear editing state after save
        setEditingFields((prev) => {
            const next = { ...prev };
            if (next[entry.id]) {
                delete next[entry.id][field];
                if (Object.keys(next[entry.id]).length === 0) {
                    delete next[entry.id];
                }
            }
            return next;
        });
    }, [onStudentFieldChange, editingFields]);

    /**
     * Handle student field change (update local state).
     */
    const handleStudentFieldEdit = React.useCallback((
        entryId: string,
        field: 'studentPage' | 'studentStatus',
        value: string,
    ) => {
        setEditingFields((prev) => ({
            ...prev,
            [entryId]: {
                ...prev[entryId],
                [field]: value,
            },
        }));
    }, []);

    /**
     * Render student editable field.
     */
    const renderStudentField = React.useCallback((
        entry: PanelCommentEntry,
        field: 'studentPage' | 'studentStatus',
    ) => {
        const busy = busyEntryIds?.has(entry.id);
        const isStatusField = field === 'studentStatus';
        const placeholder = field === 'studentPage'
            ? 'Page number'
            : 'Describe how you addressed the comment';

        // Use edited value if exists, otherwise use entry value
        const editedValue = editingFields[entry.id]?.[field];
        const displayValue = editedValue ??
            (field === 'studentPage' ? entry.studentPage ?? '' : entry.studentStatus ?? '');

        if (!allowStudentEdit) {
            const value = field === 'studentPage' ? entry.studentPage : entry.studentStatus;
            return (
                <Typography
                    variant="body2"
                    color={value ? 'text.primary' : 'text.secondary'}
                    sx={{ whiteSpace: isStatusField ? 'pre-line' : 'nowrap' }}
                >
                    {value || '—'}
                </Typography>
            );
        }

        return (
            <TextField
                value={displayValue}
                onChange={(e) => handleStudentFieldEdit(entry.id, field, e.target.value)}
                onBlur={() => handleStudentBlur(entry, field)}
                placeholder={placeholder}
                size="small"
                disabled={disabled || busy}
                multiline={isStatusField}
                minRows={isStatusField ? 1 : 1}
                maxRows={isStatusField ? 4 : 1}
                fullWidth
                variant="outlined"
                sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
            />
        );
    }, [allowStudentEdit, busyEntryIds, disabled, editingFields, handleStudentBlur, handleStudentFieldEdit]);

    // Convert entries to rows with rowNumber
    const rows: PanelCommentRow[] = React.useMemo(() =>
        entries.map((entry, index) => ({
            ...entry,
            rowNumber: index + 1,
        })),
        [entries]
    );

    // Build columns based on variant and state
    const columns: GridColDef<PanelCommentRow>[] = React.useMemo(() => {
        const cols: GridColDef<PanelCommentRow>[] = [
            {
                field: 'rowNumber',
                headerName: '#',
                width: 60,
                sortable: false,
                filterable: false,
            },
            {
                field: 'comment',
                headerName: 'Comments & suggestions',
                flex: 1,
                minWidth: 200,
                sortable: false,
                renderCell: (params: GridRenderCellParams<PanelCommentRow>) => (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line', py: 1 }}>
                        {params.value || '—'}
                    </Typography>
                ),
            },
            {
                field: 'reference',
                headerName: 'Page / chapter reference',
                width: 180,
                sortable: false,
                renderCell: (params: GridRenderCellParams<PanelCommentRow>) => (
                    <Typography
                        variant="body2"
                        color={params.value ? 'text.primary' : 'text.secondary'}
                    >
                        {params.value || '—'}
                    </Typography>
                ),
            },
        ];

        // Add student columns if visible
        if (showStudentColumns) {
            cols.push(
                {
                    field: 'studentPage',
                    headerName: 'Page',
                    width: 120,
                    sortable: false,
                    renderCell: (params: GridRenderCellParams<PanelCommentRow>) =>
                        renderStudentField(params.row, 'studentPage'),
                },
                {
                    field: 'studentStatus',
                    headerName: 'Status / compliance',
                    width: 200,
                    sortable: false,
                    renderCell: (params: GridRenderCellParams<PanelCommentRow>) =>
                        renderStudentField(params.row, 'studentStatus'),
                },
            );
        }

        // Add approval column if visible
        if (showApprovalColumn) {
            cols.push({
                field: 'approvalStatus',
                headerName: 'Approval',
                width: 140,
                sortable: false,
                renderCell: (params: GridRenderCellParams<PanelCommentRow>) => {
                    const approvalProps = getApprovalChipProps(params.value as PanelCommentApprovalStatus);
                    return (
                        <Chip
                            label={approvalProps.label}
                            color={approvalProps.color}
                            size="small"
                        />
                    );
                },
            });
        }

        // Add last update column
        cols.push({
            field: 'updatedAt',
            headerName: 'Last update',
            width: 150,
            sortable: false,
            renderCell: (params: GridRenderCellParams<PanelCommentRow>) => {
                const entry = params.row;
                const busy = busyEntryIds?.has(entry.id);
                return (
                    <Stack spacing={0.25}>
                        <Typography variant="body2" color="text.secondary">
                            Panel · {formatTimestamp(entry.updatedAt ?? entry.createdAt)}
                        </Typography>
                        {showStudentColumns && entry.studentUpdatedAt && (
                            <Typography variant="caption" color="text.secondary">
                                Student · {formatTimestamp(entry.studentUpdatedAt)}
                            </Typography>
                        )}
                        {busy && (
                            <Typography variant="caption" color="primary.main">Saving…</Typography>
                        )}
                    </Stack>
                );
            },
        });

        // Add actions column if needed
        if (showActions) {
            cols.push({
                field: 'actions',
                type: 'actions',
                headerName: 'Actions',
                width: canSetApproval ? 140 : 100,
                getActions: (params: GridRowParams<PanelCommentRow>) => {
                    const entry = params.row;
                    const busy = busyEntryIds?.has(entry.id);
                    const actions: React.ReactElement[] = [];

                    // Panel edit/delete actions (only when not released)
                    if (canPanelEdit && onEditEntry) {
                        actions.push(
                            <GridActionsCellItem
                                key="edit"
                                icon={<EditIcon />}
                                label="Edit comment"
                                onClick={() => onEditEntry(entry)}
                                disabled={disabled}
                                color="inherit"
                            />
                        );
                    }
                    if (canPanelEdit && onDeleteEntry) {
                        actions.push(
                            <GridActionsCellItem
                                key="delete"
                                icon={<DeleteIcon color="error" />}
                                label="Delete comment"
                                onClick={() => onDeleteEntry(entry)}
                                disabled={disabled}
                                color="inherit"
                            />
                        );
                    }

                    // Panel approval actions (only after release)
                    if (canSetApproval && onApprovalChange) {
                        // Disable both buttons when approved
                        const isApproved = entry.approvalStatus === 'approved';
                        actions.push(
                            <GridActionsCellItem
                                key="approve"
                                icon={
                                    <ApproveIcon
                                        color={isApproved ? 'success' : 'inherit'}
                                    />
                                }
                                label="Approve compliance"
                                onClick={() => onApprovalChange(entry, 'approved')}
                                disabled={disabled || isApproved}
                                color="inherit"
                            />
                        );
                        actions.push(
                            <GridActionsCellItem
                                key="revision"
                                icon={
                                    <RevisionIcon
                                        color={entry.approvalStatus === 'revision_required' ? 'warning' : 'inherit'}
                                    />
                                }
                                label="Request revision"
                                onClick={() => onApprovalChange(entry, 'revision_required')}
                                disabled={disabled || isApproved || entry.approvalStatus === 'revision_required'}
                                color="inherit"
                            />
                        );
                    }

                    // Student request review action (always show, disable when not applicable)
                    if (canRequestReview) {
                        const canRequest = entry.approvalStatus === 'revision_required';
                        const alreadyRequested = entry.approvalStatus === 'review_requested';
                        actions.push(
                            <GridActionsCellItem
                                key="requestReview"
                                icon={
                                    <RequestReviewIcon
                                        color={alreadyRequested ? 'info' : (canRequest ? 'inherit' : 'disabled')}
                                    />
                                }
                                label={alreadyRequested
                                    ? 'Review already requested'
                                    : 'Request panel to review your revisions'}
                                onClick={() => onRequestReview?.(entry)}
                                disabled={disabled || busy || !canRequest || alreadyRequested}
                                color="inherit"
                            />
                        );
                    }

                    return actions;
                },
            } as GridColDef<PanelCommentRow>);
        }

        return cols;
    }, [
        showStudentColumns, showApprovalColumn, showActions, canPanelEdit, canSetApproval,
        canRequestReview, disabled, busyEntryIds, onEditEntry, onDeleteEntry, onApprovalChange,
        onRequestReview, renderStudentField
    ]);

    return (
        <Paper variant="outlined">
            {/* Header with title and add button */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h6">{title}</Typography>
                    {variant === 'panel' && released && (
                        <Chip label="Released" color="success" size="small" />
                    )}
                </Stack>
                {variant === 'panel' && onAddEntry && !released && (
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={onAddEntry}
                        disabled={disabled}
                    >
                        Add comment
                    </Button>
                )}
            </Stack>

            {/* DataGrid */}
            <Box sx={{ width: '100%' }}>
                {!loading && entries.length === 0 ? (
                    <Box sx={{ p: 2 }}>
                        {emptyState ?? (
                            <Alert severity="info">
                                No comments recorded yet for this tab.
                            </Alert>
                        )}
                    </Box>
                ) : (
                    <MuiDataGrid
                        rows={rows}
                        columns={columns}
                        loading={loading}
                        getRowId={(row) => row.id}
                        getRowHeight={() => 'auto'}
                        disableRowSelectionOnClick
                        disableColumnMenu
                        disableColumnFilter
                        disableColumnSelector
                        hideFooter={entries.length <= 10}
                        pageSizeOptions={[10, 25, 50]}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 10 } },
                        }}
                        sx={{
                            border: 0,
                            '& .MuiDataGrid-cell': {
                                py: 1,
                                alignItems: 'flex-start',
                            },
                            '& .MuiDataGrid-row': {
                                minHeight: '52px !important',
                            },
                            '& .MuiDataGrid-columnHeaders': {
                                backgroundColor: 'action.hover',
                            },
                        }}
                    />
                )}
            </Box>
        </Paper>
    );
}

export default PanelCommentTable;
