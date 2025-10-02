import * as React from 'react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Chip, Stack, } from '@mui/material';
import { People, Delete, Edit } from '@mui/icons-material';
import { GridColDef, GridActionsCellItem, GridRowParams } from '@mui/x-data-grid';
import { DataGrid } from '../../components';
import { useSession } from '../../SessionContext';
import type { NavigationItem } from '../../types/navigation';
import type { UserProfile, UserRole } from '../../types/profile';
import { getAllUsers, getUserByEmail, setUserProfile, deleteUserProfile } from '../../utils/firebase/firestore';
import { adminCreateUserAccount, adminDeleteUserAccount } from '../../utils/firebase/auth';
import { parseUsers } from '../../utils/csvParsers';

const DEFAULT_PASSWORD = import.meta.env.VITE_DEFAULT_USER_PASSWORD || 'Password_123';

export const metadata: NavigationItem = {
    group: 'management',
    index: 0,
    title: 'Users',
    segment: 'user-management',
    icon: <People />,
    roles: ['admin', 'developer'],
};

const ROLE_OPTIONS: UserRole[] = ['student', 'editor', 'adviser', 'admin', 'developer'];

const ROLE_COLORS: Record<UserRole, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
    student: 'default',
    editor: 'info',
    adviser: 'primary',
    admin: 'error',
    developer: 'secondary',
};

interface UserFormData {
    id?: number;
    email: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    prefix?: string;
    suffix?: string;
    role: UserRole;
    department?: string;
    avatar?: string;
    phone?: string;
}

const emptyFormData: UserFormData = {
    email: '',
    firstName: '',
    lastName: '',
    role: 'student',
};

/**
 * Admin page for managing user profiles with a custom DataGrid implementation.
 */
export default function AdminUsersPage() {
    const { session } = useSession();
    const userRole = session?.user?.role;

    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [formData, setFormData] = React.useState<UserFormData>(emptyFormData);
    const [selectedUser, setSelectedUser] = React.useState<UserProfile | null>(null);
    const [formErrors, setFormErrors] = React.useState<Partial<Record<keyof UserFormData, string>>>({});
    const [saving, setSaving] = React.useState(false);

    // Calculate admin count for deletion protection
    const adminCount = React.useMemo(() => {
        return users.filter(u => u.role === 'admin').length;
    }, [users]);

    const loadUsers = React.useCallback(async () => {
        try {
            setLoading(true);
            const allUsers = await getAllUsers();
            setUsers(allUsers);
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleOpenCreateDialog = () => {
        setEditMode(false);
        setFormData(emptyFormData);
        setFormErrors({});
        setDialogOpen(true);
    };

    const handleOpenEditDialog = (user: UserProfile) => {
        setEditMode(true);
        setSelectedUser(user);
        setFormData({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            prefix: user.prefix,
            suffix: user.suffix,
            role: user.role,
            department: user.department,
            avatar: user.avatar,
            phone: user.phone,
        });
        setFormErrors({});
        setDialogOpen(true);
    };

    const handleOpenDeleteDialog = (user: UserProfile) => {
        setSelectedUser(user);
        setDeleteDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setDeleteDialogOpen(false);
        setSelectedUser(null);
        setFormData(emptyFormData);
        setFormErrors({});
    };

    const validateForm = (): boolean => {
        const errors: Partial<Record<keyof UserFormData, string>> = {};

        if (!formData.email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.email)) {
            errors.email = 'Enter a valid email address';
        }

        if (!formData.firstName.trim()) {
            errors.firstName = 'First name is required';
        }

        if (!formData.lastName.trim()) {
            errors.lastName = 'Last name is required';
        }

        if (!formData.role) {
            errors.role = 'Role is required';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        setSaving(true);
        try {
            const email = formData.email.toLowerCase().trim();

            if (!editMode) {
                // Create new user
                const existing = await getUserByEmail(email);
                if (existing) {
                    setFormErrors({ email: 'A user with this email already exists' });
                    setSaving(false);
                    return;
                }

                // Create Firebase Auth account first using Cloud Function (doesn't affect current session)
                const authResult = await adminCreateUserAccount(email, DEFAULT_PASSWORD);
                if (!authResult.success) {
                    setFormErrors({ email: `Failed to create auth account: ${authResult.message}` });
                    setSaving(false);
                    return;
                }

                const nextId = users.reduce((max, user) => Math.max(max, user.id ?? 0), 0) + 1;
                
                // Force first user to be admin
                const isFirstUser = users.length === 0;
                const userRole = isFirstUser ? 'admin' : formData.role;
                
                const newUser: UserProfile = {
                    id: nextId,
                    email,
                    firstName: formData.firstName.trim(),
                    middleName: formData.middleName?.trim(),
                    lastName: formData.lastName.trim(),
                    prefix: formData.prefix?.trim(),
                    suffix: formData.suffix?.trim(),
                    role: userRole,
                    department: formData.department?.trim(),
                    avatar: formData.avatar?.trim(),
                    phone: formData.phone?.trim(),
                };

                // setUserProfile now automatically cleans empty values
                await setUserProfile(email, newUser);
                
                // Show notification if role was changed to admin
                if (isFirstUser && formData.role !== 'admin') {
                    alert('First user created as admin. At least one admin account is required in the system.');
                }
            } else {
                // Update existing user
                if (!selectedUser) return;

                const updatedUser: UserProfile = {
                    ...selectedUser,
                    email,
                    firstName: formData.firstName.trim(),
                    middleName: formData.middleName?.trim(),
                    lastName: formData.lastName.trim(),
                    prefix: formData.prefix?.trim(),
                    suffix: formData.suffix?.trim(),
                    role: formData.role,
                    department: formData.department?.trim(),
                    avatar: formData.avatar?.trim(),
                    phone: formData.phone?.trim(),
                };

                // Handle email change
                if (email !== selectedUser.email) {
                    await deleteUserProfile(selectedUser.email);
                }

                // setUserProfile now automatically cleans empty values
                await setUserProfile(email, updatedUser);
            }

            await loadUsers();
            handleCloseDialog();
        } catch (error) {
            console.error('Failed to save user:', error);
            setFormErrors({ email: 'Failed to save user. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedUser) return;

        // Prevent deletion of last admin
        if (selectedUser.role === 'admin' && adminCount <= 1) {
            alert('Cannot delete the last admin account. At least one admin must exist in the system.');
            return;
        }

        setSaving(true);
        try {
            // Delete Firebase Auth account first
            const authResult = await adminDeleteUserAccount({ email: selectedUser.email });
            if (!authResult.success) {
                console.error('Failed to delete auth account:', authResult.message);
                // Continue anyway to clean up Firestore
            }

            // Delete Firestore profile
            await deleteUserProfile(selectedUser.email);
            await loadUsers();
            handleCloseDialog();
        } catch (error) {
            console.error('Failed to delete user:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleMultiDelete = async (deletedUsers: UserProfile[]) => {
        try {
            // Count how many admins would remain after deletion
            const deletedAdmins = deletedUsers.filter(u => u.role === 'admin').length;
            const remainingAdmins = adminCount - deletedAdmins;

            if (remainingAdmins < 1) {
                alert('Cannot delete all admin accounts. At least one admin must exist in the system.');
                throw new Error('Cannot delete last admin');
            }

            // Delete all selected users (both auth and Firestore)
            await Promise.all(
                deletedUsers.map(async user => {
                    // Delete auth account
                    const authResult = await adminDeleteUserAccount({ email: user.email });
                    if (!authResult.success) {
                        console.error(`Failed to delete auth for ${user.email}:`, authResult.message);
                    }
                    // Delete Firestore profile
                    return deleteUserProfile(user.email);
                })
            );
            // Refresh the user list
            await loadUsers();
        } catch (error) {
            console.error('Failed to delete users:', error);
            throw error;
        }
    };

    const handleExport = (selectedUsers: UserProfile[]) => {
        // Convert to CSV
        const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Role', 'Department', 'Phone', 'Last Active'];
        const csvRows = selectedUsers.map(user => [
            user.id,
            user.email,
            user.firstName,
            user.lastName,
            user.role,
            user.department || '',
            user.phone || '',
            user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Never'
        ].join(','));

        const csv = [headers.join(','), ...csvRows].join('\n');

        // Download file
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleImport = async (file: File) => {
        try {
            const text = await file.text();
            const { parsed, errors: parseErrors } = parseUsers(text);

            const errors: string[] = [];
            if (parseErrors.length) errors.push(...parseErrors.map(e => `Parse: ${e}`));

            // Filter out already-existing users and prepare to import
            const toImport: (UserProfile & { password?: string })[] = [];
            for (let i = 0; i < parsed.length; i++) {
                const u = parsed[i];
                const exists = await getUserByEmail(u.email.toLowerCase());
                if (exists) {
                    errors.push(`Row ${i + 2}: user ${u.email} already exists`);
                    continue;
                }
                toImport.push(u as UserProfile & { password?: string });
            }

            if (toImport.length === 0) {
                alert(`No users to import.\n\nErrors:\n${errors.join('\n')}`);
                return;
            }

            // Create auth accounts and Firestore profiles
            for (const user of toImport) {
                const pwd = (user as any).password || DEFAULT_PASSWORD;
                const authResult = await adminCreateUserAccount(user.email, pwd);
                if (!authResult.success) {
                    errors.push(`Auth create failed for ${user.email}: ${authResult.message}`);
                    continue;
                }

                // Remove any password before saving profile
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { password: _pwd, ...profile } = user as any;

                // setUserProfile now automatically cleans empty values
                await setUserProfile(user.email, profile);
            }

            await loadUsers();

            const message = `Imported ${toImport.length} user(s).`;
            if (errors.length) alert(`${message}\n\nErrors:\n${errors.join('\n')}`);
            else alert(message);
        } catch (err) {
            console.error('Import failed', err);
            alert('Failed to import CSV. See console for details.');
        }
    };

    const handleInlineUpdate = async (newRow: UserProfile, oldRow: UserProfile): Promise<UserProfile> => {
        try {
            const email = newRow.email.toLowerCase().trim();

            // Handle email change
            if (email !== oldRow.email) {
                await deleteUserProfile(oldRow.email);
            }

            const updatedUser: UserProfile = {
                ...newRow,
                email,
                firstName: newRow.firstName.trim(),
                middleName: newRow.middleName?.trim(),
                lastName: newRow.lastName.trim(),
                prefix: newRow.prefix?.trim(),
                suffix: newRow.suffix?.trim(),
                department: newRow.department?.trim(),
                avatar: newRow.avatar?.trim(),
                phone: newRow.phone?.trim(),
            };

            // setUserProfile now automatically cleans empty values
            await setUserProfile(email, updatedUser);
            await loadUsers();
            return updatedUser;
        } catch (error) {
            console.error('Failed to update user:', error);
            throw error;
        }
    };

    const columns: GridColDef[] = [
        {
            field: 'id',
            headerName: 'ID',
            width: 70,
            type: 'number',
            editable: false,
        },
        {
            field: 'email',
            headerName: 'Email',
            flex: 1,
            minWidth: 200,
            editable: true,
        },
        {
            field: 'fullName',
            headerName: 'Full Name',
            flex: 1,
            minWidth: 200,
            editable: false,
            valueGetter: (value, row) => {
                const parts = [row.prefix, row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean);
                return parts.join(' ');
            },
        },
        {
            field: 'firstName',
            headerName: 'First Name',
            flex: 1,
            minWidth: 150,
            editable: true,
        },
        {
            field: 'lastName',
            headerName: 'Last Name',
            flex: 1,
            minWidth: 150,
            editable: true,
        },
        {
            field: 'role',
            headerName: 'Role',
            width: 130,
            type: 'singleSelect',
            valueOptions: ROLE_OPTIONS,
            editable: true,
            renderCell: (params) => (
                <Chip
                    label={params.value}
                    color={ROLE_COLORS[params.value as UserRole]}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                />
            ),
        },
        {
            field: 'department',
            headerName: 'Department',
            flex: 1,
            minWidth: 150,
            editable: true,
        },
        {
            field: 'phone',
            headerName: 'Phone',
            width: 150,
            editable: true,
        },
        {
            field: 'lastActive',
            headerName: 'Last Active',
            width: 180,
            type: 'dateTime',
            editable: false,
            valueGetter: (value) => {
                if (!value) return null;
                return value as Date;
            },
            valueFormatter: (value) => {
                if (!value) return 'Never';
                const date = new Date(value as any);
                return date.toLocaleString();
            },
        },
    ];

    const getAdditionalActions = (params: GridRowParams<UserProfile>) => [
        <GridActionsCellItem
            icon={<Delete />}
            label="Delete"
            onClick={() => handleOpenDeleteDialog(params.row)}
            showInMenu={false}
            disabled={params.row.role === 'admin' && adminCount <= 1}
        />,
    ];

    if (userRole !== 'admin' && userRole !== 'developer') {
        return (
            <Box sx={{ p: 4 }}>
                <Typography variant="h5">Not authorized</Typography>
                <Typography variant="body1">
                    You need to be an administrator or developer to manage users.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            <DataGrid
                rows={users}
                columns={columns}
                loading={loading}
                initialPage={0}
                initialPageSize={10}
                pageSizeOptions={[5, 10, 25, 50]}
                checkboxSelection
                disableRowSelectionOnClick
                height={600}
                editable
                additionalActions={getAdditionalActions}
                enableMultiDelete
                enableExport
                enableImport
                enableRefresh
                enableAdd
                enableQuickFilter
                onRowUpdate={handleInlineUpdate}
                onRowUpdateError={(error) => console.error('Update failed:', error)}
                onRowsDelete={handleMultiDelete}
                onExport={handleExport}
                onImport={handleImport}
                onRefresh={loadUsers}
                onAdd={handleOpenCreateDialog}
            />

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editMode ? 'Edit User' : 'Create New User'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            error={!!formErrors.email}
                            helperText={formErrors.email}
                            required
                            fullWidth
                        />
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Prefix"
                                value={formData.prefix || ''}
                                onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                                sx={{ width: 100 }}
                                placeholder="Dr."
                            />
                            <TextField
                                label="First Name"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                error={!!formErrors.firstName}
                                helperText={formErrors.firstName}
                                required
                                fullWidth
                            />
                        </Stack>
                        <TextField
                            label="Middle Name"
                            value={formData.middleName || ''}
                            onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                            fullWidth
                        />
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Last Name"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                error={!!formErrors.lastName}
                                helperText={formErrors.lastName}
                                required
                                fullWidth
                            />
                            <TextField
                                label="Suffix"
                                value={formData.suffix || ''}
                                onChange={(e) => setFormData({ ...formData, suffix: e.target.value })}
                                sx={{ width: 100 }}
                                placeholder="Jr."
                            />
                        </Stack>
                        <TextField
                            select
                            label="Role"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                            error={!!formErrors.role}
                            helperText={formErrors.role || (users.length === 0 && !editMode ? 'First user will be created as admin' : '')}
                            required
                            fullWidth
                            disabled={users.length === 0 && !editMode}
                        >
                            {ROLE_OPTIONS.map((role) => (
                                <MenuItem key={role} value={role}>
                                    <Chip
                                        label={role}
                                        color={ROLE_COLORS[role]}
                                        size="small"
                                        sx={{ textTransform: 'capitalize' }}
                                    />
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Department"
                            value={formData.department || ''}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            label="Phone"
                            type="tel"
                            value={formData.phone || ''}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            fullWidth
                            placeholder="+1 (555) 123-4567"
                        />
                        <TextField
                            label="Avatar URL"
                            value={formData.avatar || ''}
                            onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                            fullWidth
                            placeholder="https://example.com/avatar.jpg"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained" disabled={saving}>
                        {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Create User'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={handleCloseDialog}>
                <DialogTitle>Delete User</DialogTitle>
                <DialogContent>
                    {selectedUser?.role === 'admin' && adminCount <= 1 ? (
                        <Typography color="error">
                            Cannot delete the last admin account. At least one admin must exist in the system.
                            You can edit this user's information or change their role instead.
                        </Typography>
                    ) : (
                        <Typography>
                            Are you sure you want to delete user <strong>{selectedUser?.email}</strong>?
                            This action cannot be undone.
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} disabled={saving}>
                        {selectedUser?.role === 'admin' && adminCount <= 1 ? 'Close' : 'Cancel'}
                    </Button>
                    {!(selectedUser?.role === 'admin' && adminCount <= 1) && (
                        <Button onClick={handleDelete} variant="contained" color="error" disabled={saving}>
                            {saving ? 'Deleting...' : 'Delete'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
}
