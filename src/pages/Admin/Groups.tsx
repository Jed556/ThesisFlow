import * as React from 'react';
import {
    Autocomplete, Box, Button, Chip, Dialog, DialogActions,
    DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { AnimatedPage, GrowTransition } from '../../components/Animate';
import { DataGrid } from '../../components/DataGrid';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../../contexts/SnackbarContext';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisGroup, ThesisGroupFormData } from '../../types/group';
import type { Session } from '../../types/session';
import type { UserProfile } from '../../types/profile';
import { getAllUsers } from '../../utils/firebase/firestore';
import {
    getAllGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    setGroup,
} from '../../utils/firebase/firestore';
import { importGroupsFromCsv, exportGroupsToCsv } from '../../utils/csv';
import UnauthorizedNotice from '../../layouts/UnauthorizedNotice';

export const metadata: NavigationItem = {
    group: 'management',
    index: 1,
    title: 'Groups',
    segment: 'group-management',
    icon: <GroupsIcon />,
    roles: ['admin', 'developer'],
};

const STATUS_OPTIONS: ThesisGroup['status'][] = ['active', 'inactive', 'completed', 'archived'];

const STATUS_COLORS: Record<
    ThesisGroup['status'],
    'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
    active: 'success',
    inactive: 'default',
    completed: 'info',
    archived: 'warning',
};

const emptyFormData: ThesisGroupFormData = {
    name: '',
    description: '',
    leader: '',
    members: [],
    adviser: '',
    editor: '',
    status: 'active',
    thesisTitle: '',
    department: '',
};

/**
 * Admin page for managing thesis groups
 */
export default function AdminGroupManagementPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const userRole = session?.user?.role;

    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [formData, setFormData] = React.useState<ThesisGroupFormData>(emptyFormData);
    const [selectedGroup, setSelectedGroup] = React.useState<ThesisGroup | null>(null);
    const [formErrors, setFormErrors] = React.useState<Partial<Record<keyof ThesisGroupFormData, string>>>({});
    const [saving, setSaving] = React.useState(false);

    // Filter users by role
    const students = React.useMemo(() => users.filter((u) => u.role === 'student'), [users]);
    const advisers = React.useMemo(() => users.filter((u) => u.role === 'adviser'), [users]);
    const editors = React.useMemo(() => users.filter((u) => u.role === 'editor'), [users]);

    const loadData = React.useCallback(async () => {
        try {
            setLoading(true);
            // Load users
            const allUsers = await getAllUsers();
            setUsers(allUsers);

            // Load groups from Firestore
            const groupsData = await getAllGroups();
            setGroups(groupsData);
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('Failed to load data. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenCreateDialog = () => {
        setEditMode(false);
        setFormData(emptyFormData);
        setFormErrors({});
        setDialogOpen(true);
    };

    const handleOpenEditDialog = (group: ThesisGroup) => {
        setEditMode(true);
        setSelectedGroup(group);
        setFormData({
            id: group.id,
            name: group.name,
            description: group.description,
            leader: group.leader,
            members: group.members,
            adviser: group.adviser,
            editor: group.editor,
            status: group.status,
            thesisTitle: group.thesisTitle,
            department: group.department,
        });
        setFormErrors({});
        setDialogOpen(true);
    };

    const handleOpenDeleteDialog = (group: ThesisGroup) => {
        setSelectedGroup(group);
        setDeleteDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setDeleteDialogOpen(false);
        setSelectedGroup(null);
        setFormData(emptyFormData);
        setFormErrors({});
    };

    const validateForm = (): boolean => {
        const errors: Partial<Record<keyof ThesisGroupFormData, string>> = {};

        if (!formData.name.trim()) {
            errors.name = 'Group name is required';
        }

        if (!formData.leader) {
            errors.leader = 'Group leader is required';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        setSaving(true);
        try {
            if (!editMode) {
                // Create new group
                const newGroupData: Omit<ThesisGroup, 'id' | 'createdAt' | 'updatedAt'> = {
                    name: formData.name.trim(),
                    description: formData.description?.trim(),
                    leader: formData.leader,
                    members: formData.members,
                    adviser: formData.adviser,
                    editor: formData.editor,
                    status: formData.status,
                    thesisTitle: formData.thesisTitle?.trim(),
                    department: formData.department?.trim(),
                };

                // Save to Firestore
                const createdGroup = await createGroup(newGroupData);
                setGroups([...groups, createdGroup]);
                showNotification(`Group "${createdGroup.name}" created successfully`, 'success');
            } else {
                // Update existing group
                if (!selectedGroup) return;

                const updates: Partial<ThesisGroup> = {
                    name: formData.name.trim(),
                    description: formData.description?.trim(),
                    leader: formData.leader,
                    members: formData.members,
                    adviser: formData.adviser,
                    editor: formData.editor,
                    status: formData.status,
                    thesisTitle: formData.thesisTitle?.trim(),
                    department: formData.department?.trim(),
                };

                // Update in Firestore
                await updateGroup(selectedGroup.id, updates);
                const updatedGroup = { ...selectedGroup, ...updates, updatedAt: new Date().toISOString() };
                setGroups(groups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)));
                showNotification(`Group "${updatedGroup.name}" updated successfully`, 'success');
            }

            handleCloseDialog();
        } catch (error) {
            console.error('Error saving group:', error);
            showNotification('Failed to save group. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedGroup) return;

        setSaving(true);
        try {
            // Delete from Firestore
            await deleteGroup(selectedGroup.id);
            setGroups(groups.filter((g) => g.id !== selectedGroup.id));
            showNotification(`Group "${selectedGroup.name}" deleted successfully`, 'success');
            handleCloseDialog();
        } catch (error) {
            console.error('Error deleting group:', error);
            showNotification('Failed to delete group. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleMultiDelete = async (deletedGroups: ThesisGroup[]) => {
        try {
            // Delete from Firestore
            await Promise.all(deletedGroups.map((g) => deleteGroup(g.id)));
            const deletedIds = new Set(deletedGroups.map((g) => g.id));
            setGroups(groups.filter((g) => !deletedIds.has(g.id)));
            showNotification(`Successfully deleted ${deletedGroups.length} group(s)`, 'success');
        } catch (error) {
            console.error('Error deleting groups:', error);
            showNotification('Failed to delete groups. Please try again.', 'error');
            throw error;
        }
    };

    const handleExport = (selectedGroups: ThesisGroup[]) => {
        try {
            const csvText = exportGroupsToCsv(selectedGroups);
            const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `groups-export-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showNotification(`Exported ${selectedGroups.length} group(s) to CSV`, 'success');
        } catch (error) {
            console.error('Error exporting groups:', error);
            showNotification('Failed to export groups to CSV', 'error');
        }
    };

    const handleImport = async (file: File) => {
        try {
            const text = await file.text();
            const { parsed: importedGroups, errors: parseErrors } = importGroupsFromCsv(text);

            const errors: string[] = [];
            if (parseErrors.length) errors.push(...parseErrors.map((e: string) => `Parse: ${e}`));

            // Import groups to Firestore
            for (const groupData of importedGroups) {
                const groupId = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                await setGroup(groupId, {
                    ...groupData,
                    id: groupId,
                });
            }

            // Reload data
            await loadData();

            if (errors.length > 0) {
                showNotification(`Imported ${importedGroups.length} group(s) with ${errors.length} warning(s)`, 'warning');
            } else {
                showNotification(`Successfully imported ${importedGroups.length} group(s)`, 'success');
            }
        } catch (error) {
            console.error('Error importing groups:', error);
            showNotification('Failed to import groups from CSV', 'error');
        }
    };

    const columns: GridColDef<ThesisGroup>[] = [
        {
            field: 'name',
            headerName: 'Group Name',
            flex: 1,
            minWidth: 200,
            editable: false,
        },
        {
            field: 'thesisTitle',
            headerName: 'Thesis Title',
            flex: 1.5,
            minWidth: 250,
            editable: false,
        },
        {
            field: 'leader',
            headerName: 'Leader',
            flex: 1,
            minWidth: 200,
            editable: false,
            valueGetter: (value) => {
                const user = users.find((u) => u.email === value);
                return user ? `${user.name.first} ${user.name.last}` : value;
            },
        },
        {
            field: 'members',
            headerName: 'Members',
            flex: 1,
            minWidth: 150,
            editable: false,
            renderCell: (params) => (
                <Chip label={`${params.value.length} member${params.value.length !== 1 ? 's' : ''}`} size="small" />
            ),
        },
        {
            field: 'adviser',
            headerName: 'Adviser',
            flex: 1,
            minWidth: 180,
            editable: false,
            valueGetter: (value) => {
                if (!value) return '—';
                const user = users.find((u) => u.email === value);
                return user ? `${user.name.first} ${user.name.last}` : value;
            },
        },
        {
            field: 'editor',
            headerName: 'Editor',
            flex: 1,
            minWidth: 180,
            editable: false,
            valueGetter: (value) => {
                if (!value) return '—';
                const user = users.find((u) => u.email === value);
                return user ? `${user.name.first} ${user.name.last}` : value;
            },
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 120,
            editable: false,
            renderCell: (params) => (
                <Chip
                    label={params.value}
                    color={STATUS_COLORS[params.value as ThesisGroup['status']]}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                />
            ),
        },
    ];

    const getAdditionalActions = (params: GridRowParams<ThesisGroup>) => [
        <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Edit"
            onClick={() => handleOpenEditDialog(params.row)}
            showInMenu={false}
        />,
        <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => handleOpenDeleteDialog(params.row)}
            showInMenu={false}
        />,
    ];

    if (userRole !== 'admin' && userRole !== 'developer') {
        return (
            <AnimatedPage variant="fade">
                <UnauthorizedNotice description="You need to be an administrator or developer to manage groups." />
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ width: '100%' }}>
                <DataGrid
                    rows={groups}
                    columns={columns}
                    loading={loading}
                    initialPage={0}
                    initialPageSize={10}
                    pageSizeOptions={[5, 10, 25, 50]}
                    checkboxSelection
                    disableRowSelectionOnClick
                    height={600}
                    editable={false}
                    additionalActions={getAdditionalActions}
                    enableMultiDelete
                    enableExport
                    enableImport
                    enableRefresh
                    enableAdd
                    enableQuickFilter
                    onRowsDelete={handleMultiDelete}
                    onExport={handleExport}
                    onImport={handleImport}
                    onRefresh={loadData}
                    onAdd={handleOpenCreateDialog}
                />

                {/* Create/Edit Dialog */}
                <Dialog
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    maxWidth="md"
                    fullWidth
                    slots={{ transition: GrowTransition }}
                >
                    <DialogTitle>{editMode ? 'Edit Group' : 'Create New Group'}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2.5} sx={{ mt: 1 }}>
                            <TextField
                                label="Group Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                error={!!formErrors.name}
                                helperText={formErrors.name}
                                required
                                fullWidth
                            />

                            <TextField
                                label="Description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                multiline
                                rows={2}
                                fullWidth
                            />

                            <TextField
                                label="Thesis Title"
                                value={formData.thesisTitle || ''}
                                onChange={(e) => setFormData({ ...formData, thesisTitle: e.target.value })}
                                fullWidth
                            />

                            <TextField
                                label="Department"
                                value={formData.department || ''}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                fullWidth
                            />

                            <Autocomplete
                                options={students}
                                getOptionLabel={(option) => `${option.name.first} ${option.name.last} (${option.email})`}
                                value={students.find((u) => u.email === formData.leader) || null}
                                onChange={(_, newValue) => setFormData({ ...formData, leader: newValue?.email || '' })}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Group Leader"
                                        required
                                        error={!!formErrors.leader}
                                        helperText={formErrors.leader}
                                    />
                                )}
                            />

                            <Autocomplete
                                multiple
                                options={students}
                                getOptionLabel={(option) => `${option.name.first} ${option.name.last} (${option.email})`}
                                value={students.filter((u) => formData.members.includes(u.email))}
                                onChange={(_, newValue) =>
                                    setFormData({ ...formData, members: newValue.map((u) => u.email) })
                                }
                                renderInput={(params) => <TextField {...params} label="Members" />}
                            />

                            <Autocomplete
                                options={advisers}
                                getOptionLabel={(option) => `${option.name.first} ${option.name.last} (${option.email})`}
                                value={advisers.find((u) => u.email === formData.adviser) || null}
                                onChange={(_, newValue) => setFormData({ ...formData, adviser: newValue?.email || '' })}
                                renderInput={(params) => <TextField {...params} label="Adviser (Optional)" />}
                            />

                            <Autocomplete
                                options={editors}
                                getOptionLabel={(option) => `${option.name.first} ${option.name.last} (${option.email})`}
                                value={editors.find((u) => u.email === formData.editor) || null}
                                onChange={(_, newValue) => setFormData({ ...formData, editor: newValue?.email || '' })}
                                renderInput={(params) => <TextField {...params} label="Editor (Optional)" />}
                            />

                            <TextField
                                select
                                label="Status"
                                value={formData.status}
                                onChange={(e) =>
                                    setFormData({ ...formData, status: e.target.value as ThesisGroup['status'] })
                                }
                                slotProps={{ select: { native: true } }}
                                fullWidth
                            >
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </option>
                                ))}
                            </TextField>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} variant="contained" disabled={saving}>
                            {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Create Group'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <Dialog open={deleteDialogOpen} onClose={handleCloseDialog} slots={{ transition: GrowTransition }}>
                    <DialogTitle>Delete Group</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to delete group <strong>{selectedGroup?.name}</strong>? This action
                            cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleDelete} variant="contained" color="error" disabled={saving}>
                            {saving ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </AnimatedPage>
    );
}
