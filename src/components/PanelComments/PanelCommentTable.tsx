import * as React from 'react';
import {
    Alert, Button, CircularProgress, IconButton, Paper, Stack, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import type { PanelCommentEntry } from '../../types/panelComment';
import { formatRelative, normalizeDateInput } from '../../utils/dateUtils';

export type PanelCommentTableVariant = 'student' | 'panel' | 'admin';

export interface PanelCommentTableProps {
    entries: PanelCommentEntry[];
    variant: PanelCommentTableVariant;
    loading?: boolean;
    disabled?: boolean;
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
}

function formatTimestamp(value?: string) {
    const date = normalizeDateInput(value);
    if (!date) {
        return '—';
    }
    return formatRelative(date, { style: 'short' }, new Date());
}

/**
 * Shared table component for displaying panel comment entries across student, panel, and admin views.
 */
export function PanelCommentTable({
    entries,
    variant,
    loading = false,
    disabled = false,
    busyEntryIds,
    emptyState,
    onAddEntry,
    onEditEntry,
    onDeleteEntry,
    onStudentFieldChange,
}: PanelCommentTableProps) {
    const showStudentColumns = variant !== 'panel';
    const allowStudentEdit = variant === 'student' && Boolean(onStudentFieldChange);
    const showActions = variant === 'panel' && (!!onEditEntry || !!onDeleteEntry);

    const handleStudentBlur = React.useCallback((entry: PanelCommentEntry, field: 'studentPage' | 'studentStatus') => (
        event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        if (!onStudentFieldChange) {
            return;
        }
        const nextValue = event.target.value.trim();
        const currentValue = (field === 'studentPage' ? entry.studentPage : entry.studentStatus) ?? '';
        if (nextValue === currentValue.trim()) {
            return;
        }
        onStudentFieldChange(entry, field, nextValue);
    }, [onStudentFieldChange]);

    const renderStudentField = (entry: PanelCommentEntry, field: 'studentPage' | 'studentStatus') => {
        const busy = busyEntryIds?.has(entry.id);
        const keySuffix = field === 'studentPage'
            ? entry.studentPage ?? ''
            : entry.studentStatus ?? '';
        const isStatusField = field === 'studentStatus';
        const placeholder = field === 'studentPage'
            ? 'Page number'
            : 'Describe how you addressed the comment';
        return (
            <TextField
                key={`${entry.id}-${field}-${keySuffix}`}
                defaultValue={field === 'studentPage' ? entry.studentPage ?? '' : entry.studentStatus ?? ''}
                placeholder={placeholder}
                size="small"
                disabled={disabled || busy || !allowStudentEdit}
                multiline={isStatusField}
                minRows={isStatusField ? 2 : 1}
                maxRows={isStatusField ? 6 : 1}
                fullWidth
                onBlur={handleStudentBlur(entry, field)}
            />
        );
    };

    return (
        <Paper variant="outlined">
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
                <Typography variant="h6">Panel comment sheet</Typography>
                {variant === 'panel' && onAddEntry && (
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
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell width={56}>#</TableCell>
                            <TableCell>Comments & suggestions</TableCell>
                            <TableCell width="18%">Page / chapter reference</TableCell>
                            {showStudentColumns && (
                                <TableCell width="12%">Page</TableCell>
                            )}
                            {showStudentColumns && (
                                <TableCell width="20%">Status / compliance</TableCell>
                            )}
                            <TableCell width="14%">Last update</TableCell>
                            {showActions && <TableCell align="right" width={80}>Actions</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={showStudentColumns ? 6 + Number(showActions) : 4 + Number(showActions)}>
                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                                        <CircularProgress size={20} />
                                        <Typography variant="body2" color="text.secondary">Loading comments…</Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && entries.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={showStudentColumns ? 6 + Number(showActions) : 4 + Number(showActions)}>
                                    {emptyState ?? (
                                        <Alert severity="info" sx={{ my: 2 }}>
                                            No comments recorded yet for this tab.
                                        </Alert>
                                    )}
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && entries.map((entry, index) => {
                            const busy = busyEntryIds?.has(entry.id);
                            return (
                                <TableRow key={entry.id} hover>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                                            {entry.comment || '—'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color={entry.reference ? 'text.primary' : 'text.secondary'}>
                                            {entry.reference || '—'}
                                        </Typography>
                                    </TableCell>
                                    {showStudentColumns && (
                                        <TableCell>
                                            {allowStudentEdit ? (
                                                renderStudentField(entry, 'studentPage')
                                            ) : (
                                                <Typography variant="body2" color={entry.studentPage ?
                                                    'text.primary' : 'text.secondary'}>
                                                    {entry.studentPage || '—'}
                                                </Typography>
                                            )}
                                        </TableCell>
                                    )}
                                    {showStudentColumns && (
                                        <TableCell>
                                            {allowStudentEdit ? (
                                                renderStudentField(entry, 'studentStatus')
                                            ) : (
                                                <Typography variant="body2" color={entry.studentStatus ?
                                                    'text.primary' : 'text.secondary'} sx={{ whiteSpace: 'pre-line' }}>
                                                    {entry.studentStatus || '—'}
                                                </Typography>
                                            )}
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <Stack spacing={0.5}>
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
                                    </TableCell>
                                    {showActions && (
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                {onEditEntry && (
                                                    <Tooltip title="Edit comment">
                                                        <span>
                                                            <IconButton size="small" onClick={() => onEditEntry(entry)}
                                                                disabled={disabled}>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                                {onDeleteEntry && (
                                                    <Tooltip title="Delete comment">
                                                        <span>
                                                            <IconButton size="small" color="error"
                                                                onClick={() => onDeleteEntry(entry)} disabled={disabled}>
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

export default PanelCommentTable;
