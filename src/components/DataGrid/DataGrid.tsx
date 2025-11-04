import * as React from 'react';
import {
    DataGrid as MuiDataGrid, GridRowModes, GridRowEditStopReasons, GridActionsCellItem,
    Toolbar, ToolbarButton, ColumnsPanelTrigger, FilterPanelTrigger, ExportPrint,
    useGridApiContext, QuickFilter, QuickFilterClear, QuickFilterControl, QuickFilterTrigger,
} from '@mui/x-data-grid';
import type {
    GridColDef, GridRowModesModel, GridEventListener, GridRowParams,
    GridValidRowModel, GridRowId, GridRowSelectionModel, GridSlots,
} from '@mui/x-data-grid';
import { Paper, Tooltip, TextField, InputAdornment, Menu, MenuItem, Divider, Badge } from '@mui/material';
import {
    DragIndicator, Edit, Save, Cancel, Delete, FileDownload, Upload, Refresh, Add, Search as SearchIcon,
    CancelOutlined as CancelIcon, ViewColumn as ViewColumnIcon, FilterList as FilterListIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';

// Styled components for QuickFilter with smooth transitions
type OwnerState = {
    expanded: boolean;
};

const StyledQuickFilter = styled(QuickFilter)({
    display: 'grid',
    alignItems: 'center',
});

const StyledToolbarButton = styled(ToolbarButton)<{ ownerState: OwnerState }>(
    ({ theme, ownerState }) => ({
        gridArea: '1 / 1',
        width: 'min-content',
        height: 'min-content',
        zIndex: 1,
        opacity: ownerState.expanded ? 0 : 1,
        pointerEvents: ownerState.expanded ? 'none' : 'auto',
        transition: theme.transitions.create(['opacity']),
    }),
);

const StyledTextField = styled(TextField)<{
    ownerState: OwnerState;
}>(({ theme, ownerState }) => ({
    gridArea: '1 / 1',
    overflowX: 'clip',
    width: ownerState.expanded ? 260 : 'var(--trigger-width)',
    opacity: ownerState.expanded ? 1 : 0,
    transition: theme.transitions.create(['width', 'opacity']),
}));

export interface DataGridProps<T extends GridValidRowModel> {
    /** Array of data rows to display */
    rows: T[];
    /** Column definitions (do not include actions column - it will be added automatically) */
    columns: GridColDef[];
    /** Loading state */
    loading?: boolean;
    /** Enable row reordering with drag handle */
    reorderable?: boolean;
    /** Enable inline editing (default: true) */
    editable?: boolean;
    /** Additional action items to show in actions column (shown in view mode alongside Edit button) */
    additionalActions?: (params: GridRowParams<T>) => React.ReactElement<typeof GridActionsCellItem>[];
    /** Enable multi-row deletion when checkboxSelection is enabled */
    enableMultiDelete?: boolean;
    /** Enable export functionality for selected rows */
    enableExport?: boolean;
    /** Enable import functionality */
    enableImport?: boolean;
    /** Enable refresh button in toolbar */
    enableRefresh?: boolean;
    /** Enable add button in toolbar */
    enableAdd?: boolean;
    /** Enable quick filter search box in toolbar */
    enableQuickFilter?: boolean;
    /** Callback when rows are deleted */
    onRowsDelete?: (deletedRows: T[]) => Promise<void> | void;
    /** Callback when export is triggered */
    onExport?: (selectedRows: T[]) => void;
    /** Callback when import is triggered */
    onImport?: (file: File) => Promise<void> | void;
    /** Callback when refresh button is clicked */
    onRefresh?: () => void;
    /** Callback when add button is clicked */
    onAdd?: () => void;
    /** Callback when row order changes */
    onRowOrderChange?: (newRows: T[]) => void;
    /** Callback when a row is updated via inline edit */
    onRowUpdate?: (newRow: T, oldRow: T) => Promise<T> | T;
    /** Callback when row update fails */
    onRowUpdateError?: (error: Error) => void;
    /** Initial pagination model */
    initialPage?: number;
    /** Initial page size */
    initialPageSize?: number;
    /** Available page size options */
    pageSizeOptions?: number[];
    /** Enable checkbox selection */
    checkboxSelection?: boolean;
    /** Custom height for the grid */
    height?: number | string;
    /** Disable row selection on click */
    disableRowSelectionOnClick?: boolean;
    /** Disable column menu */
    disableColumnMenu?: boolean;
    /** Disable column filter */
    disableColumnFilter?: boolean;
    /** Disable column selector */
    disableColumnSelector?: boolean;
    /** Disable column sorting */
    disableColumnSorting?: boolean;
    /** Show toolbar */
    showToolbar?: boolean;
    /** Additional slots for customization */
    slots?: Partial<GridSlots>;
    /** Additional sx styles for the Paper wrapper */
    sx?: SxProps<Theme>;
    /** Additional sx styles for the DataGrid itself */
    gridSx?: SxProps<Theme>;
    /** Callback when rows are selected */
    onRowSelectionChange?: (selectedIds: GridRowSelectionModel) => void;
}/**
 * Modular DataGrid component with optional reordering and inline editing.
 * Built on top of MUI X DataGrid with enhanced features.
 * 
 * @example
 * // Basic usage
 * <DataGrid rows={users} columns={columns} />
 * 
 * @example
 * // With reordering
 * <DataGrid
 *   rows={users}
 *   columns={columns}
 *   reorderable
 *   onRowOrderChange={handleReorder}
 * />
 * 
 * @example
 * // With inline editing
 * <DataGrid
 *   rows={users}
 *   columns={columns}
 *   editable
 *   onRowUpdate={handleUpdate}
 * />
 */
export default function DataGrid<T extends GridValidRowModel>({
    rows,
    columns,
    loading = false,
    reorderable = false,
    editable = true,
    additionalActions,
    enableMultiDelete = false,
    enableExport = false,
    enableImport = false,
    enableRefresh = false,
    enableAdd = false,
    enableQuickFilter = false,
    onRowsDelete,
    onExport,
    onImport,
    onRefresh,
    onAdd,
    onRowOrderChange,
    onRowUpdate,
    onRowUpdateError,
    initialPage = 0,
    initialPageSize = 10,
    pageSizeOptions = [5, 10, 25, 50],
    checkboxSelection = false,
    height = 600,
    disableRowSelectionOnClick = true,
    disableColumnMenu = false,
    disableColumnFilter = false,
    disableColumnSelector = false,
    disableColumnSorting = false,
    showToolbar = true,
    slots,
    sx,
    gridSx,
    onRowSelectionChange,
}: DataGridProps<T>) {
    const [internalRows, setInternalRows] = React.useState<T[]>(rows);
    const [draggedRow, setDraggedRow] = React.useState<T | null>(null);
    const [rowModesModel, setRowModesModel] = React.useState<GridRowModesModel>({});
    const [selectedRowIds, setSelectedRowIds] = React.useState<GridRowId[]>([]);
    const [deleting, setDeleting] = React.useState(false);
    const [importing, setImporting] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const hasMultipleSelections = selectedRowIds.length > 1;

    // Sync external rows with internal state
    React.useEffect(() => {
        setInternalRows(rows);
    }, [rows]);

    // Handle drag start
    const handleDragStart = (row: T) => {
        setDraggedRow(row);
    };

    // Handle drag over
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // Handle drop
    const handleDrop = (targetRow: T) => {
        if (!draggedRow || draggedRow.id === targetRow.id) return;

        const draggedIndex = internalRows.findIndex((r) => r.id === draggedRow.id);
        const targetIndex = internalRows.findIndex((r) => r.id === targetRow.id);

        const newRows = [...internalRows];
        newRows.splice(draggedIndex, 1);
        newRows.splice(targetIndex, 0, draggedRow);

        setInternalRows(newRows);
        setDraggedRow(null);

        if (onRowOrderChange) {
            onRowOrderChange(newRows);
        }
    };

    // Handle edit click
    const handleEditClick = (id: GridRowId) => () => {
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
    };

    // Handle save click
    const handleSaveClick = (id: GridRowId) => () => {
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
    };

    // Handle cancel click
    const handleCancelClick = (id: GridRowId) => () => {
        setRowModesModel({
            ...rowModesModel,
            [id]: { mode: GridRowModes.View, ignoreModifications: true },
        });
    };

    // Handle multi delete
    const handleMultiDelete = async () => {
        if (!onRowsDelete || selectedRowIds.length === 0) return;

        setDeleting(true);
        try {
            const rowsToDelete = internalRows.filter((row) => selectedRowIds.includes(row.id));
            await onRowsDelete(rowsToDelete);
            setSelectedRowIds([]);
        } catch (error) {
            console.error('Failed to delete rows:', error);
        } finally {
            setDeleting(false);
        }
    };

    // Handle export
    const handleExport = () => {
        if (!onExport) return;

        const rowsToExport = selectedRowIds.length > 0
            ? internalRows.filter((row) => selectedRowIds.includes(row.id))
            : internalRows;

        onExport(rowsToExport);
    };

    // Handle import
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !onImport) return;

        setImporting(true);
        try {
            await onImport(file);
            // Clear the input so the same file can be selected again
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Failed to import file:', error);
        } finally {
            setImporting(false);
        }
    };

    // Handle row selection change
    const handleSelectionChange = (model: GridRowSelectionModel) => {
        const ids = Array.isArray(model) ? model : [];
        setSelectedRowIds(ids);
        if (onRowSelectionChange) {
            onRowSelectionChange(model);
        }
    };

    // Handle row edit stop
    const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event) => {
        if (params.reason === GridRowEditStopReasons.rowFocusOut) {
            event.defaultMuiPrevented = true;
        }
    };

    // Process row update
    const processRowUpdate = async (newRow: T, oldRow: T) => {
        if (onRowUpdate) {
            try {
                const updatedRow = await onRowUpdate(newRow, oldRow);
                return updatedRow;
            } catch (error) {
                if (onRowUpdateError) {
                    onRowUpdateError(error as Error);
                }
                return oldRow;
            }
        }
        return newRow;
    };

    // Build columns with drag handle if reorderable
    const enhancedColumns: GridColDef[] = React.useMemo(() => {
        const cols: GridColDef[] = [...columns];

        // Add drag handle column if reorderable
        if (reorderable) {
            cols.unshift({
                field: '__drag_handle__',
                headerName: '',
                width: 50,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                renderCell: (params) => (
                    <div
                        draggable
                        onDragStart={() => handleDragStart(params.row)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(params.row)}
                        style={{ cursor: 'grab', display: 'flex', alignItems: 'center', height: '100%' }}
                    >
                        <DragIndicator sx={{ color: 'text.secondary' }} />
                    </div>
                ),
            });
        }

        // Add edit actions column if editable
        if (editable || additionalActions) {
            const actionsColumn: GridColDef = {
                field: '__actions__',
                type: 'actions',
                headerName: 'Actions',
                width: 120,
                getActions: (params: GridRowParams) => {
                    // Hide actions when multiple rows are selected
                    if (hasMultipleSelections) {
                        return [];
                    }

                    const isInEditMode = rowModesModel[params.id]?.mode === GridRowModes.Edit;

                    if (isInEditMode && editable) {
                        // Show Save and Cancel when in edit mode
                        return [
                            <GridActionsCellItem
                                key="save"
                                icon={<Save />}
                                label="Save"
                                onClick={handleSaveClick(params.id)}
                                color="primary"
                            />,
                            <GridActionsCellItem
                                key="cancel"
                                icon={<Cancel />}
                                label="Cancel"
                                onClick={handleCancelClick(params.id)}
                                color="inherit"
                            />,
                        ];
                    }

                    // Show Edit button and additional actions when in view mode
                    const actions: React.ReactElement<typeof GridActionsCellItem>[] = [];

                    if (editable) {
                        actions.push(
                            <GridActionsCellItem
                                icon={<Edit />}
                                label="Edit"
                                onClick={handleEditClick(params.id)}
                                color="inherit"
                            />
                        );
                    }

                    if (additionalActions) {
                        actions.push(...additionalActions(params));
                    }

                    return actions;
                },
            };

            cols.push(actionsColumn);
        }

        return cols;
    }, [columns, reorderable, editable, additionalActions, rowModesModel, hasMultipleSelections]);

    // Custom Toolbar Component
    const CustomToolbar = () => {
        const apiRef = useGridApiContext();
        const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
        const exportMenuTriggerRef = React.useRef<HTMLButtonElement>(null);

        // Check if there are active filters
        const hasActiveFilters = React.useMemo(() => {
            const filterModel = apiRef.current.state.filter?.filterModel;
            return (filterModel?.items && filterModel.items.length > 0) ||
                (filterModel?.quickFilterValues && filterModel.quickFilterValues.length > 0);
        }, [apiRef.current.state.filter?.filterModel]);

        // Get filtered row count
        const filteredRowsCount = React.useMemo(() => {
            if (!hasActiveFilters) return 0;
            const visibleRows = apiRef.current.getRowModels();
            return visibleRows.size;
        }, [hasActiveFilters, apiRef.current.state.filter?.filterModel, internalRows]);

        // Get active filter count for badge
        const filterCount = React.useMemo(() => {
            const filterModel = apiRef.current.state.filter?.filterModel;
            return filterModel?.items?.length || 0;
        }, [apiRef.current.state.filter?.filterModel]);

        const handleExportFiltered = () => {
            if (!onExport) return;

            // Get filtered rows
            const visibleRowIds = Array.from(apiRef.current.getRowModels().keys());
            const filteredRows = internalRows.filter((row) => visibleRowIds.includes(row.id));
            onExport(filteredRows);
            setExportMenuOpen(false);
        };

        const handleExportSelected = () => {
            handleExport();
            setExportMenuOpen(false);
        };

        const handleExportAll = () => {
            handleExport();
            setExportMenuOpen(false);
        };

        return (
            <Toolbar>
                {/* Custom Action Buttons - Refresh & Add */}
                {enableRefresh && onRefresh && (
                    <Tooltip title="Refresh">
                        <ToolbarButton onClick={onRefresh} disabled={loading}>
                            <Refresh fontSize="small" />
                        </ToolbarButton>
                    </Tooltip>
                )}

                {enableAdd && onAdd && (
                    <Tooltip title="Add">
                        <ToolbarButton onClick={onAdd}>
                            <Add fontSize="small" />
                        </ToolbarButton>
                    </Tooltip>
                )}

                {/* Columns Panel Trigger */}
                <Tooltip title="Columns">
                    <ColumnsPanelTrigger
                        render={(triggerProps, state) => (
                            <ToolbarButton {...triggerProps}>
                                <ViewColumnIcon fontSize="small" />
                            </ToolbarButton>
                        )}
                    />
                </Tooltip>

                {/* Filter Panel Trigger */}
                <Tooltip title="Filters">
                    <FilterPanelTrigger
                        render={(triggerProps, state) => (
                            <ToolbarButton {...triggerProps}>
                                <Badge badgeContent={filterCount} color="primary" variant="dot">
                                    <FilterListIcon fontSize="small" />
                                </Badge>
                            </ToolbarButton>
                        )}
                    />
                </Tooltip>

                <Divider orientation="vertical" variant="middle" flexItem sx={{ mx: 0.5 }} />

                {/* Import Button */}
                {enableImport && onImport && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        <Tooltip title="Import">
                            <ToolbarButton onClick={handleImportClick} disabled={importing}>
                                <Upload fontSize="small" />
                            </ToolbarButton>
                        </Tooltip>
                    </>
                )}

                {/* Export Menu */}
                {enableExport && onExport && (
                    <>
                        <Tooltip title="Export">
                            <ToolbarButton
                                ref={exportMenuTriggerRef}
                                id="export-menu-trigger"
                                aria-controls="export-menu"
                                aria-haspopup="true"
                                aria-expanded={exportMenuOpen ? 'true' : undefined}
                                onClick={() => setExportMenuOpen(true)}
                            >
                                <FileDownload fontSize="small" />
                            </ToolbarButton>
                        </Tooltip>
                        <Menu
                            id="export-menu"
                            anchorEl={exportMenuTriggerRef.current}
                            open={exportMenuOpen}
                            onClose={() => setExportMenuOpen(false)}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            slotProps={{
                                paper: {
                                    'aria-labelledby': 'export-menu-trigger',
                                },
                            }}
                        >
                            {/* Export Selected - Only when rows are selected */}
                            {selectedRowIds.length > 0 && (
                                <MenuItem onClick={handleExportSelected}>
                                    Export Selected ({selectedRowIds.length})
                                </MenuItem>
                            )}

                            {/* Export Filtered - Only when filters are active and no selection */}
                            {hasActiveFilters && selectedRowIds.length === 0 && (
                                <MenuItem onClick={handleExportFiltered}>
                                    Export Filtered ({filteredRowsCount})
                                </MenuItem>
                            )}

                            {/* Export All - Only when no filters and no selection */}
                            {!hasActiveFilters && selectedRowIds.length === 0 && internalRows.length > 0 && (
                                <MenuItem onClick={handleExportAll}>
                                    Download as CSV
                                </MenuItem>
                            )}

                            {/* Divider if there are options */}
                            {internalRows.length > 0 && <Divider />}

                            <ExportPrint render={<MenuItem />} onClick={() => setExportMenuOpen(false)}>
                                Print
                            </ExportPrint>
                        </Menu>
                    </>
                )}

                {/* Delete Selected Button */}
                {enableMultiDelete && onRowsDelete && selectedRowIds.length > 0 && (
                    <Tooltip title={`Delete ${selectedRowIds.length} selected row(s)`}>
                        <ToolbarButton onClick={handleMultiDelete} disabled={deleting}>
                            <Delete fontSize="small" />
                        </ToolbarButton>
                    </Tooltip>
                )}

                {/* Quick Filter - if enabled */}
                {enableQuickFilter && (
                    <StyledQuickFilter>
                        <QuickFilterTrigger
                            render={(triggerProps, state) => (
                                <Tooltip title="Search" enterDelay={0}>
                                    <StyledToolbarButton
                                        {...triggerProps}
                                        ownerState={{ expanded: state.expanded }}
                                        color="default"
                                        aria-disabled={state.expanded}
                                    >
                                        <SearchIcon fontSize="small" />
                                    </StyledToolbarButton>
                                </Tooltip>
                            )}
                        />
                        <QuickFilterControl
                            render={({ ref, ...controlProps }, state) => (
                                <StyledTextField
                                    {...controlProps}
                                    ownerState={{ expanded: state.expanded }}
                                    inputRef={ref}
                                    aria-label="Search"
                                    placeholder="Search..."
                                    size="small"
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" />
                                                </InputAdornment>
                                            ),
                                            endAdornment: state.value ? (
                                                <InputAdornment position="end">
                                                    <QuickFilterClear
                                                        edge="end"
                                                        size="small"
                                                        aria-label="Clear search"
                                                        material={{ sx: { marginRight: -0.75 } }}
                                                    >
                                                        <CancelIcon fontSize="small" />
                                                    </QuickFilterClear>
                                                </InputAdornment>
                                            ) : null,
                                            ...controlProps.slotProps?.input,
                                        },
                                        ...controlProps.slotProps,
                                    }}
                                />
                            )}
                        />
                    </StyledQuickFilter>
                )}
            </Toolbar>
        );
    };

    return (
        <Paper sx={{ width: '100%', height, ...sx }}>
            <MuiDataGrid
                rows={internalRows}
                columns={enhancedColumns}
                loading={loading}
                editMode="row"
                rowModesModel={rowModesModel}
                onRowModesModelChange={setRowModesModel}
                onRowEditStop={handleRowEditStop}
                processRowUpdate={processRowUpdate}
                onProcessRowUpdateError={onRowUpdateError}
                initialState={{
                    pagination: {
                        paginationModel: { page: initialPage, pageSize: initialPageSize },
                    },
                }}
                pageSizeOptions={pageSizeOptions}
                checkboxSelection={checkboxSelection}
                disableRowSelectionOnClick={disableRowSelectionOnClick}
                onRowSelectionModelChange={handleSelectionChange}
                slots={{
                    toolbar: CustomToolbar,
                    ...slots,
                }}
                slotProps={{
                    loadingOverlay: {
                        variant: 'skeleton',
                        noRowsVariant: 'skeleton',
                    },
                }}
                disableColumnMenu={disableColumnMenu}
                disableColumnFilter={disableColumnFilter}
                disableColumnSelector={disableColumnSelector}
                disableColumnSorting={disableColumnSorting}
                showToolbar={showToolbar}
                sx={{ border: 0, ...gridSx }}

            />
        </Paper>
    );
}
