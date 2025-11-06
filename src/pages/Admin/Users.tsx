import * as React from 'react';
import {
    Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Chip, Stack
} from '@mui/material';
import { People, Delete } from '@mui/icons-material';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { AnimatedPage, GrowTransition } from '../../components/Animate';
import { DataGrid } from '../../components/DataGrid';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../../contexts/SnackbarContext';
import type { NavigationItem } from '../../types/navigation';
import type { UserProfile, UserRole } from '../../types/profile';
import type { Session } from '../../types/session';
import {
    getAllUsers, getUserById, getUserByEmail, setUserProfile, deleteUserProfile, createPersonalCalendar
} from '../../utils/firebase/firestore';
import { adminCreateUserAccount, adminDeleteUserAccount, adminUpdateUserAccount } from '../../utils/firebase/auth/admin';
import { importUsersFromCsv, exportUsersToCsv } from '../../utils/csv/user';

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

type ImportedUser = UserProfile & { password?: string };

const emptyFormData: UserProfile = {
    uid: '',
    email: '',
    name: {
        first: '',
        last: '',
    },
    role: 'student',
};

/**
 * Admin page for managing user profiles with a custom DataGrid implementation.
 */
export default function AdminUsersPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const userRole = session?.user?.role;

    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [formData, setFormData] = React.useState<UserProfile>(emptyFormData);
    const [selectedUser, setSelectedUser] = React.useState<UserProfile | null>(null);
    const [formErrors, setFormErrors] = React.useState<Partial<Record<keyof UserProfile | 'name.first' | 'name.last', string>>>({});
    const [saving, setSaving] = React.useState(false);

    // Calculate admin count for deletion protection
    const adminCount = React.useMemo(() => {
        return users.filter(u => u.role === 'admin').length;
    }, [users]);

    if (session?.loading) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="h5" component="h1">
                        Loading user management
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Please wait while we confirm your access level.
                    </Typography>
                </Box>
            </AnimatedPage>
        );
    }

    const loadUsers = React.useCallback(async () => {
        try {
            setLoading(true);
            const allUsers = await getAllUsers();
            setUsers(allUsers);
        } catch (error) {
            showNotification('Failed to load users. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification]);

    React.useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleOpenCreateDialog = () => {
        setEditMode(false);
        // If this is the first user, force admin role
        const isFirstUser = users.length === 0;
        setFormData(isFirstUser ? { ...emptyFormData, role: 'admin' } : emptyFormData);
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
        const errors: Partial<Record<keyof UserProfile | 'name.first' | 'name.last', string>> = {};

        if (!formData.uid) {
            errors.uid = 'Student No. is required';
        }

        if (!formData.email) {
            errors.email = 'Email is required';
        } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.email)) {
            errors.email = 'Enter a valid email address';
        }

        if (!formData.name.first) {
            errors['name.first'] = 'First name is required';
        }

        if (!formData.name.last) {
            errors['name.last'] = 'Last name is required';
        }

        if (!formData.role) {
            errors.role = 'Role is required';
        }

        // Prevent changing the last admin to non-admin role
        if (editMode && selectedUser?.role === 'admin' && formData.role !== 'admin' && adminCount <= 1) {
            errors.role = 'Cannot change the last admin to a different role. At least one admin must exist.';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        setSaving(true);
        try {
            const { uid, email, name, role, department, avatar, phone } = formData;

            if (!editMode) {
                // Create new user
                const existingID = await getUserById(uid);
                if (existingID) {
                    setFormErrors({ uid: 'A user with this ID already exists' });
                    setSaving(false);
                    return;
                }
                const existingEmail = await getUserByEmail(email);
                if (existingEmail) {
                    setFormErrors({ email: 'A user with this email already exists' });
                    setSaving(false);
                    return;
                }

                // Force first user to be admin
                const isFirstUser = users.length === 0;
                const userRole = isFirstUser ? 'admin' : role;

                // Create Firebase Auth account first using Cloud Function (doesn't affect current session)
                const authResult = await adminCreateUserAccount(uid, email, DEFAULT_PASSWORD, userRole);
                if (!authResult.success) {
                    setFormErrors({ email: `Failed to create auth account: ${authResult.message}` });
                    setSaving(false);
                    return;
                }

                const newUser: UserProfile = {
                    ...formData, role: userRole,
                };

                // setUserProfile now automatically cleans empty values
                await setUserProfile(uid, newUser);

                // Create personal calendar for the new user
                try {
                    if (uid) {
                        await createPersonalCalendar(uid);
                    } else {
                        console.warn('User created but UID not available for calendar creation');
                    }
                } catch (error) {
                    showNotification('User created but calendar creation failed', 'warning');
                }

                // Show notification if role was changed to admin
                if (isFirstUser && role !== 'admin') {
                    showNotification('Created as Admin. At least one admin account is required in the system.', 'info', 8000);
                } else {
                    showNotification(`User ${newUser.name.first} ${newUser.name.last} created successfully`, 'success');
                }
            } else {
                // Update existing user
                if (!selectedUser) return;
                const updatedUser: UserProfile = formData;

                // Update Firebase Auth if email or role changed
                const emailChanged = email !== selectedUser.email;
                const roleChanged = role !== selectedUser.role;

                if (emailChanged || roleChanged) {
                    // Get the user's UID first
                    try {
                        const authResult = await adminUpdateUserAccount({
                            uid: selectedUser.uid, // We'll need to store UID in the profile
                            email: emailChanged ? email : undefined,
                            role: roleChanged ? role : undefined,
                        });

                        if (authResult.success) {
                            await deleteUserProfile(selectedUser.email);
                            await setUserProfile(selectedUser.uid, updatedUser);
                        } else {
                            showNotification(`Auth update failed: ${authResult.message}.`, 'error', 6000);
                        }
                    } catch (error) {
                        showNotification('Failed to update User.', 'error', 6000);
                    }
                }

                // setUserProfile now automatically cleans empty values
                showNotification(`User ${updatedUser.name.first} ${updatedUser.name.last} updated successfully`, 'success');
            }

            await loadUsers();
            handleCloseDialog();
        } catch (error) {
            showNotification('Failed to save user. Please try again.', 'error');
            setFormErrors({ email: 'Failed to save user. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedUser) return;

        // Prevent deletion of last admin
        if (selectedUser.role === 'admin' && adminCount <= 1) {
            showNotification('Cannot delete the last admin account. At least one admin must exist in the system.', 'error', 8000);
            return;
        }

        setSaving(true);
        try {
            // Delete Firebase Auth account first
            const authResult = await adminDeleteUserAccount({ email: selectedUser.email });
            if (!authResult.success) {
                showNotification(`Auth deletion failed: ${authResult.message}. Continuing with profile cleanup.`, 'warning', 6000);
            }

            // Delete Firestore profile
            await deleteUserProfile(selectedUser.email);
            showNotification(`User ${selectedUser.name.first} ${selectedUser.name.last} deleted successfully`, 'success');
            await loadUsers();
            handleCloseDialog();
        } catch (error) {
            showNotification('Failed to delete user. Please try again.', 'error');
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
                showNotification('Cannot delete all admin accounts. At least one admin must exist in the system.', 'error', 8000);
                throw new Error('Cannot delete last admin');
            }

            // Delete all selected users (both auth and Firestore)
            const errors: string[] = [];
            await Promise.all(
                deletedUsers.map(async user => {
                    // Delete auth account
                    const authResult = await adminDeleteUserAccount({ email: user.email });
                    if (!authResult.success) {
                        errors.push(`${user.email}: ${authResult.message}`);
                    }
                    // Delete Firestore profile
                    return deleteUserProfile(user.email);
                })
            );

            // Refresh the user list
            await loadUsers();

            if (errors.length > 0) {
                showNotification(
                    `Deleted ${deletedUsers.length} user(s) with some auth errors`,
                    'warning',
                    6000,
                    {
                        label: 'View Details',
                        onClick: () => showNotification(`Auth errors:\n${errors.join('\n')}`, 'info', 0)
                    }
                );
            } else {
                showNotification(`Successfully deleted ${deletedUsers.length} user(s)`, 'success');
            }
        } catch (error) {
            showNotification('Failed to delete users. Please try again.', 'error');
            throw error;
        }
    };

    const handleExport = (selectedUsers: UserProfile[]) => {
        try {
            const csvText = exportUsersToCsv(selectedUsers);
            const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `users-export-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showNotification(`Exported ${selectedUsers.length} user(s) to CSV`, 'success');
        } catch (error) {
            showNotification('Failed to export users to CSV', 'error');
        }
    };

    const handleImport = async (file: File) => {
        try {
            const text = await file.text();
            const { parsed, errors: parseErrors } = importUsersFromCsv(text);

            const errors: string[] = [];
            if (parseErrors.length) errors.push(...parseErrors.map((e: string) => `Parse: ${e}`));

            // Filter out already-existing users and prepare to import
            const toImport: ImportedUser[] = [];
            for (let i = 0; i < parsed.length; i++) {
                const u = parsed[i];
                const exists = await getUserById(u.uid);
                if (exists) {
                    errors.push(`Row ${i + 2}: user ${u.email} already exists`);
                    continue;
                }
                toImport.push(u);
            }

            if (toImport.length === 0) {
                showNotification(
                    'No users to import',
                    'warning',
                    0,
                    errors.length > 0 ? {
                        label: 'View Errors',
                        onClick: () => showNotification(`Import errors:\n${errors.join('\n')}`, 'error', 0)
                    } : undefined
                );
                return;
            }

            // Create auth accounts and Firestore profiles
            for (const user of toImport) {
                const { password: importPassword, ...profileNoPassword } = user;
                const password = importPassword || DEFAULT_PASSWORD;
                const authResult = await adminCreateUserAccount(user.email, password, user.role);
                if (!authResult.success) {
                    errors.push(`Auth create failed for ${user.email}: ${authResult.message}`);
                    continue;
                }

                // Store the UID in the profile
                const profileWithUid = {
                    ...profileNoPassword,
                    uid: authResult.uid,
                };

                // setUserProfile now automatically cleans empty values
                await setUserProfile(user.email, profileWithUid);
            }

            await loadUsers();

            if (errors.length) {
                showNotification(
                    `Imported ${toImport.length} user(s) with some errors`,
                    'warning',
                    6000,
                    {
                        label: 'View Errors',
                        onClick: () => showNotification(`Import errors:\n${errors.join('\n')}`, 'error', 0)
                    }
                );
            } else {
                showNotification(`Successfully imported ${toImport.length} user(s)`, 'success');
            }
        } catch (error) {
            showNotification('Failed to import CSV. Please check the file format and try again.', 'error');
        }
    };

    const handleInlineUpdate = async (newRow: UserProfile, oldRow: UserProfile): Promise<UserProfile> => {
        try {
            // Prevent changing the last admin to non-admin role
            if (oldRow.role === 'admin' && newRow.role !== 'admin' && adminCount <= 1) {
                showNotification(
                    'Cannot change the last admin to a different role. At least one admin must exist in the system.',
                    'error',
                    8000
                );
                return oldRow;
            }

            const email = newRow.email;
            const emailChanged = email !== oldRow.email;
            const roleChanged = newRow.role !== oldRow.role;
            let updatedUser: UserProfile = { ...newRow };

            // Update Firebase Auth if email or role changed
            if ((emailChanged || roleChanged) && oldRow.uid) {
                try {
                    const authResult = await adminUpdateUserAccount({
                        uid: oldRow.uid,
                        email: emailChanged ? email : undefined,
                        role: roleChanged ? newRow.role : undefined,
                    });

                    if (authResult.success) {
                        // Handle email change in Firestore
                        if (emailChanged) {
                            await deleteUserProfile(oldRow.email);
                        }

                        updatedUser = {
                            ...newRow,
                            email,
                            name: {
                                first: newRow.name.first,
                                middle: newRow.name.middle,
                                last: newRow.name.last,
                                prefix: newRow.name.prefix,
                                suffix: newRow.name.suffix,
                            },
                            department: newRow.department,
                            avatar: newRow.avatar,
                            phone: newRow.phone,
                        };

                        // setUserProfile now automatically cleans empty values
                        await setUserProfile(email, updatedUser);
                    } else {
                        showNotification(`Auth update failed: ${authResult.message}.`, 'warning', 4000);
                    }
                } catch (error) {
                    showNotification('Failed to update user profile.', 'warning', 4000);
                }
            }

            await loadUsers();
            showNotification('User updated successfully', 'success', 3000);
            return updatedUser;
        } catch (error) {
            showNotification('Failed to update user. Please try again.', 'error');
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
                const date = new Date(value as Date);
                return date.toLocaleString();
            },
        },
    ];

    const getAdditionalActions = (params: GridRowParams<UserProfile>) => [
        <GridActionsCellItem
            key="delete"
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
        <AnimatedPage variant="fade">
            <Box sx={{ width: '100%' }}>
                <DataGrid
                    rows={users.map(user => ({ ...user, id: user.uid }))}
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
                    onRowUpdateError={(error) => showNotification('Update failed: ' + error.message, 'error')}
                    onRowsDelete={handleMultiDelete}
                    onExport={handleExport}
                    onImport={handleImport}
                    onRefresh={loadUsers}
                    onAdd={handleOpenCreateDialog}
                />

                {/* Create/Edit Dialog */}
                <Dialog
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    maxWidth="sm"
                    fullWidth
                    slots={{ transition: GrowTransition }}
                >
                    <DialogTitle>{editMode ? 'Edit User' : 'Create New User'}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField
                                label="Student No."
                                value={formData.uid.trim()}
                                onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                                error={!!formErrors.uid}
                                helperText={formErrors.uid || 'Unique student number or identifier'}
                                required
                                fullWidth
                                disabled={editMode}
                            />
                            <TextField
                                label="Email"
                                type="email"
                                value={formData.email.trim()}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                error={!!formErrors.email}
                                helperText={formErrors.email}
                                required
                                fullWidth
                            />
                            <Stack direction="row" spacing={2}>
                                <TextField
                                    label="Prefix"
                                    value={formData.name.prefix?.trim() || ''}
                                    onChange={(e) => setFormData({ ...formData, name: { ...formData.name, prefix: e.target.value } })}
                                    sx={{ width: 100 }}
                                    placeholder="Dr."
                                />
                                <TextField
                                    label="First Name"
                                    value={formData.name.first.trim()}
                                    onChange={(e) => setFormData({ ...formData, name: { ...formData.name, first: e.target.value } })}
                                    error={!!formErrors['name.first']}
                                    helperText={formErrors['name.first']}
                                    required
                                    fullWidth
                                />
                            </Stack>
                            <TextField
                                label="Middle Name"
                                value={formData.name.middle?.trim() || ''}
                                onChange={(e) => setFormData({ ...formData, name: { ...formData.name, middle: e.target.value } })}
                                fullWidth
                            />
                            <Stack direction="row" spacing={2}>
                                <TextField
                                    label="Last Name"
                                    value={formData.name.last.trim()}
                                    onChange={(e) => setFormData({ ...formData, name: { ...formData.name, last: e.target.value } })}
                                    error={!!formErrors['name.last']}
                                    helperText={formErrors['name.last']}
                                    required
                                    fullWidth
                                />
                                <TextField
                                    label="Suffix"
                                    value={formData.name.suffix?.trim() || ''}
                                    onChange={(e) => setFormData({ ...formData, name: { ...formData.name, suffix: e.target.value } })}
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
                                helperText={
                                    formErrors.role ||
                                    (users.length === 0 && !editMode
                                        ? 'First user will be created as admin'
                                        : '') ||
                                    (editMode && selectedUser?.role === 'admin' && adminCount <= 1
                                        ? 'Cannot change role of last admin account'
                                        : '')
                                }
                                required
                                fullWidth
                                disabled={
                                    (users.length === 0 && !editMode) ||
                                    (editMode && selectedUser?.role === 'admin' && adminCount <= 1)
                                }
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
                                value={formData.department?.trim() || ''}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                fullWidth
                            />
                            <TextField
                                label="Phone"
                                type="tel"
                                value={formData.phone?.trim() || ''}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                fullWidth
                                placeholder="+1 (555) 123-4567"
                            />
                            <TextField
                                label="Avatar URL"
                                value={formData.avatar?.trim() || ''}
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
                <Dialog open={deleteDialogOpen} onClose={handleCloseDialog} slots={{ transition: GrowTransition }}>
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
        </AnimatedPage>
    );
}
