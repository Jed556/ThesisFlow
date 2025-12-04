import * as React from 'react';
import {
    Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, Chip, Stack, Avatar, IconButton, CircularProgress
} from '@mui/material';
import { People, Delete, PhotoCamera, Close } from '@mui/icons-material';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { AnimatedPage, GrowTransition } from '../../../components/Animate';
import { DataGrid } from '../../../components/DataGrid';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import type { NavigationItem } from '../../../types/navigation';
import type { UserProfile, UserRole } from '../../../types/profile';
import type { Session } from '../../../types/session';
import {
    findAllUsers, findUserById, findUserByEmail, setUserProfile, updateUserProfile,
    deleteUserProfile, createPersonalCalendarForUser,
} from '../../../utils/firebase/firestore';
import { getAcademicYear } from '../../../utils/dateUtils';
import { adminCreateUserAccount, adminDeleteUserAccount, adminUpdateUserAccount } from '../../../utils/firebase/auth/admin';
import { importUsersFromCsv, exportUsersToCsv } from '../../../utils/csv/user';
import { validateAvatarFile, createAvatarPreview, uploadAvatar } from '../../../utils/avatarUtils';
import { useBackgroundJobControls, useBackgroundJobFlag } from '../../../hooks/useBackgroundJobs';

const DEFAULT_PASSWORD = import.meta.env.VITE_DEFAULT_USER_PASSWORD || 'Password_123';

export const metadata: NavigationItem = {
    group: 'management',
    index: 0,
    title: 'Users',
    segment: 'user-management',
    icon: <People />,
    roles: ['admin', 'developer'],
};

const ROLE_OPTIONS: UserRole[] = [
    'student', 'statistician', 'editor', 'adviser', 'panel', 'moderator', 'head', 'admin', 'developer'
];

const ROLE_COLORS: Record<UserRole, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
    student: 'default',
    statistician: 'info',
    editor: 'info',
    adviser: 'primary',
    panel: 'secondary',
    moderator: 'warning',
    head: 'success',
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
    course: '',
};

/**
 * Admin page for managing user profiles with a custom DataGrid implementation.
 */
export default function AdminUsersPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const { startJob } = useBackgroundJobControls();
    const userRole = session?.user?.role;

    // Track active user import jobs without re-rendering on progress updates
    const hasActiveImport = useBackgroundJobFlag(
        React.useCallback((job) => {
            if (job.status !== 'pending' && job.status !== 'running') {
                return false;
            }
            return job.name.startsWith('Importing users');
        }, [])
    );

    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [formData, setFormData] = React.useState<UserProfile>(emptyFormData);
    const [selectedUser, setSelectedUser] = React.useState<UserProfile | null>(null);
    const [formErrors, setFormErrors] = React.useState<Partial<Record<keyof UserProfile | 'name.first' | 'name.last', string>>>({});
    const [saving, setSaving] = React.useState(false);
    const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = React.useState<string>('');
    const [uploadingAvatar, setUploadingAvatar] = React.useState(false);

    // Track if component is mounted to prevent reloads after navigation
    const isMountedRef = React.useRef(true);
    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

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
        // Don't reload if there's an active import in progress (to prevent lag)
        if (hasActiveImport) {
            return;
        }

        try {
            setLoading(true);
            const allUsers = await findAllUsers();
            setUsers(allUsers);
        } catch {
            showNotification('Failed to load users. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification, hasActiveImport]);

    React.useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    function handleOpenCreateDialog() {
        setEditMode(false);
        // If this is the first user, force admin role
        const isFirstUser = users.length === 0;
        setFormData(isFirstUser ? { ...emptyFormData, role: 'admin' } : emptyFormData);
        setFormErrors({});
        setDialogOpen(true);
    };

    function handleOpenDeleteDialog(user: UserProfile) {
        setSelectedUser(user);
        setDeleteDialogOpen(true);
    };

    function handleCloseDialog() {
        setDialogOpen(false);
        setDeleteDialogOpen(false);
        setSelectedUser(null);
        setFormData(emptyFormData);
        setFormErrors({});
        setAvatarFile(null);
        setAvatarPreview('');
    };

    async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file
        const validation = validateAvatarFile(file);
        if (!validation.valid) {
            showNotification(validation.error!, 'error');
            return;
        }

        setAvatarFile(file);

        // Create preview
        try {
            const previewUrl = await createAvatarPreview(file);
            setAvatarPreview(previewUrl);
        } catch {
            showNotification('Failed to create preview', 'error');
        }
    };

    async function handleAvatarUpload(
        avatarFile: File,
        uid: string,
        onUploadingChange: (uploading: boolean) => void
    ) {
        try {
            onUploadingChange(true);
            await uploadAvatar(avatarFile, uid);
            showNotification('Avatar uploaded successfully', 'success', 3000);
        } catch (error) {
            // Avatar upload failed, but user is already created - just warn
            showNotification(
                `User created but avatar upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'warning',
                6000
            );
        } finally {
            onUploadingChange(false);
        }
    };

    function handleRemoveAvatar() {
        setAvatarFile(null);
        setAvatarPreview('');
        setFormData({ ...formData, avatar: '' });
    };

    function validateForm(): boolean {
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

    async function handleSave() {
        if (!validateForm()) return;

        setSaving(true);

        try {
            const { uid, email, role } = formData;

            if (!editMode) {
                // Create new user
                const existingID = await findUserById(uid);
                if (existingID) {
                    setFormErrors({ uid: 'A user with this ID already exists' });
                    setSaving(false);
                    return;
                }
                const existingEmail = await findUserByEmail(email);
                if (existingEmail) {
                    setFormErrors({ email: 'A user with this email already exists' });
                    setSaving(false);
                    return;
                }

                // Force first user to be admin
                const isFirstUser = users.length === 0;
                const userRole = isFirstUser ? 'admin' : role;

                // STEP 1: Create Firebase Auth account first
                const authResult = await adminCreateUserAccount(
                    uid,
                    email,
                    DEFAULT_PASSWORD,
                    userRole,
                );
                if (!authResult.success) {
                    // Step 1 failed - do nothing, just show error and return
                    setFormErrors({ email: `Failed to create auth account: ${authResult.message}` });
                    setSaving(false);
                    return;
                }

                // STEP 2: Create Firestore entry
                const newUser: UserProfile = {
                    ...formData,
                    role: userRole,
                    avatar: formData.avatar, // Keep existing avatar URL if any
                };

                // Build context for hierarchical path
                const userContext = {
                    year: getAcademicYear(),
                    department: newUser.department,
                    course: newUser.course,
                };

                try {
                    await setUserProfile(uid, userRole, userContext, newUser);
                } catch {
                    // Step 2 failed - delete auth account to avoid orphaned accounts
                    showNotification('Failed to create user profile. Rolling back...', 'error');
                    try {
                        await adminDeleteUserAccount({ uid });
                    } catch {
                        showNotification('Failed to rollback auth account. Manual cleanup may be required.', 'error', 0);
                    }
                    setSaving(false);
                    return;
                }

                // STEP 3: Upload avatar (assume this won't fail, but handle gracefully)
                if (avatarFile) {
                    await handleAvatarUpload(avatarFile, uid, setUploadingAvatar);
                }

                // Create personal calendar for the new user
                try {
                    if (uid) {
                        await createPersonalCalendarForUser(uid, userRole, userContext);
                    } else {
                        console.warn('User created but UID not available for calendar creation');
                    }
                } catch {
                    showNotification('User created but calendar creation failed', 'warning');
                }

                // Show notification if role was changed to admin
                if (isFirstUser && role !== 'admin') {
                    showNotification('Created as Admin. At least one admin account is required in the system.', 'info', 8000);
                } else {
                    showNotification(`User ${newUser.name?.first ?? ''} ${newUser.name?.last ?? ''} created successfully`, 'success');
                }
            } else {
                // Update existing user
                if (!selectedUser) return;

                // For updates, upload avatar first if changed
                let avatarUrl = formData.avatar;
                if (avatarFile) {
                    try {
                        setUploadingAvatar(true);
                        avatarUrl = await uploadAvatar(avatarFile, selectedUser.uid);
                        showNotification('Avatar uploaded successfully', 'success', 3000);
                    } catch (error) {
                        showNotification(
                            `Avatar upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            'warning'
                        );
                        // Continue with update even if avatar fails
                    } finally {
                        setUploadingAvatar(false);
                    }
                }

                const updatedUser: UserProfile = {
                    ...formData,
                    avatar: avatarUrl,
                };

                // Update Firebase Auth if email or role changed
                const emailChanged = email !== selectedUser.email;
                const roleChanged = role !== selectedUser.role;

                if (emailChanged || roleChanged) {
                    try {
                        const authResult = await adminUpdateUserAccount({
                            uid: selectedUser.uid,
                            email: emailChanged ? email : undefined,
                            role: roleChanged ? role : undefined,
                        });

                        if (authResult.success) {
                            await deleteUserProfile(selectedUser.uid);
                            // Use setUserProfile with context for new path after role change
                            const userContext = {
                                year: getAcademicYear(),
                                department: updatedUser.department,
                                course: updatedUser.course,
                            };
                            await setUserProfile(selectedUser.uid, role, userContext, updatedUser);
                        } else {
                            showNotification(`Auth update failed: ${authResult.message}.`, 'error', 6000);
                        }
                    } catch {
                        showNotification('Failed to update User.', 'error', 6000);
                    }
                } else {
                    // Just update the profile in place
                    await updateUserProfile(selectedUser.uid, updatedUser);
                }

                showNotification(
                    `User ${updatedUser.name?.first ?? ''} ${updatedUser.name?.last ?? ''} updated successfully`,
                    'success');
            }

            await loadUsers();
            handleCloseDialog();
        } catch {
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
            await deleteUserProfile(selectedUser.uid);
            showNotification(
                `User ${selectedUser?.name?.first ?? selectedUser?.email} ${selectedUser?.name?.last ?? ''} deleted successfully`,
                'success');
            await loadUsers();
            handleCloseDialog();
        } catch {
            showNotification('Failed to delete user. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    async function handleMultiDelete(deletedUsers: UserProfile[]) {
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
                    return deleteUserProfile(user.uid);
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

    function handleExport(selectedUsers: UserProfile[]) {
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
        } catch {
            showNotification('Failed to export users to CSV', 'error');
        }
    };

    async function handleImport(file: File) {
        // Start the import as a background job so users can navigate away
        startJob(
            `Importing users from ${file.name}`,
            async (updateProgress, signal) => {
                // Parse CSV file
                const text = await file.text();
                const { parsed, errors: parseErrors } = importUsersFromCsv(text);

                const errors: string[] = [];
                if (parseErrors.length) errors.push(...parseErrors.map((e: string) => `Parse: ${e}`));

                // Check if aborted
                if (signal.aborted) throw new Error('Import cancelled');

                // Filter out already-existing users and prepare to import
                const toImport: ImportedUser[] = [];
                for (let i = 0; i < parsed.length; i++) {
                    const u = parsed[i];
                    const exists = await findUserById(u.uid);
                    if (exists) {
                        errors.push(`Row ${i + 2}: user ${u.email} already exists`);
                        continue;
                    }
                    toImport.push(u);
                }

                if (toImport.length === 0) {
                    // Return immediately if nothing to import
                    return {
                        count: 0,
                        errors,
                        message: 'No users to import',
                    };
                }

                // Check if aborted before starting imports
                if (signal.aborted) throw new Error('Import cancelled');

                // Create auth accounts and Firestore profiles
                let successCount = 0;
                for (let i = 0; i < toImport.length; i++) {
                    // Check for cancellation before each user
                    if (signal.aborted) throw new Error('Import cancelled');

                    const user = toImport[i];
                    const { password: importPassword, ...profileNoPassword } = user;
                    const password = importPassword || DEFAULT_PASSWORD;

                    // Update progress
                    updateProgress({
                        current: i + 1,
                        total: toImport.length,
                        message: `Creating user ${user.email}`,
                    });

                    try {
                        const authResult = await adminCreateUserAccount(
                            user.uid,
                            user.email,
                            password,
                            user.role,
                        );
                        if (!authResult.success) {
                            errors.push(`Auth create failed for ${user.email}: ${authResult.message}`);
                            continue;
                        }

                        // Store the UID in the profile
                        const profileWithUid: UserProfile = {
                            ...profileNoPassword,
                            uid: authResult.uid ?? user.uid,
                        };

                        // setUserProfile now automatically cleans empty values
                        const profileUid = profileWithUid.uid ?? user.uid;
                        if (!profileUid) {
                            errors.push(`Missing UID after creating auth record for ${user.email}`);
                            continue;
                        }
                        // Build context for hierarchical path
                        const importContext = {
                            year: getAcademicYear(),
                            department: profileWithUid.department,
                            course: profileWithUid.course,
                        };
                        await setUserProfile(profileUid, user.role, importContext, profileWithUid);
                        successCount++;
                    } catch (error) {
                        errors.push(`Failed to create ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                return {
                    count: successCount,
                    errors,
                    total: toImport.length,
                };
            },
            { fileName: file.name, fileSize: file.size, jobType: 'users-import' },
            // Completion callback
            (job) => {
                // Only reload users if component is still mounted (user is still on this page)
                // Force reload even if import is "active" since we're in the completion callback
                if (isMountedRef.current) {
                    // Call findAllUsers directly to bypass the hasActiveImport check
                    (async () => {
                        try {
                            setLoading(true);
                            const allUsers = await findAllUsers();
                            setUsers(allUsers);
                        } catch {
                            // Silent fail - notification will be shown for job status
                        } finally {
                            setLoading(false);
                        }
                    })();
                }

                if (job.status === 'completed' && job.result) {
                    const result = job.result as { count: number; errors: string[]; total?: number };

                    if (result.errors.length > 0) {
                        showNotification(
                            `Imported ${result.count} of ${result.total ?? result.count} user(s) with some errors`,
                            'warning',
                            6000,
                            {
                                label: 'View Errors',
                                onClick: () => showNotification(`Import errors:\n${result.errors.join('\n')}`, 'error', 0)
                            }
                        );
                    } else {
                        showNotification(`Successfully imported ${result.count} user(s)`, 'success');
                    }
                } else if (job.status === 'failed') {
                    showNotification(`Import failed: ${job.error}`, 'error');
                }
            }
        );

        // Show immediate feedback that the import has started
        showNotification(
            'Import started in background. You can navigate away and it will continue.',
            'info',
            5000
        );
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
                            await deleteUserProfile(oldRow.uid);
                        }

                        updatedUser = {
                            ...newRow,
                            email,
                            name: {
                                first: newRow.name?.first ?? '',
                                middle: newRow.name?.middle ?? '',
                                last: newRow.name?.last ?? '',
                                prefix: newRow.name?.prefix ?? '',
                                suffix: newRow.name?.suffix ?? '',
                            },
                            department: newRow.department,
                            course: newRow.course,
                            avatar: newRow.avatar,
                            phone: newRow.phone,
                        };

                        // Build context for hierarchical path (using new role path if changed)
                        const inlineContext = {
                            year: getAcademicYear(),
                            department: updatedUser.department,
                            course: updatedUser.course,
                        };
                        await setUserProfile(oldRow.uid, newRow.role, inlineContext, updatedUser);
                    } else {
                        showNotification(`Auth update failed: ${authResult.message}.`, 'warning', 4000);
                    }
                } catch {
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
            headerName: 'UID',
            width: 100,
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
            field: 'namePrefix',
            headerName: 'Prefix',
            flex: 1,
            minWidth: 100,
            editable: true,
        },
        {
            field: 'nameFirst',
            headerName: 'First Name',
            flex: 1,
            minWidth: 150,
            editable: true,
        },
        {
            field: 'nameMiddle',
            headerName: 'Middle Name',
            flex: 1,
            minWidth: 150,
            editable: true,
        },
        {
            field: 'nameLast',
            headerName: 'Last Name',
            flex: 1,
            minWidth: 150,
            editable: true,
        },
        {
            field: 'nameSuffix',
            headerName: 'Suffix',
            flex: 1,
            minWidth: 130,
            editable: true,
        },
        {
            field: 'role',
            headerName: 'Role',
            width: 100,
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
            field: 'course',
            headerName: 'Course',
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
                    rows={users.map(user => ({
                        ...user,
                        id: user.uid,
                        namePrefix: user.name?.prefix || '',
                        nameFirst: user.name?.first || '',
                        nameMiddle: user.name?.middle || '',
                        nameLast: user.name?.last || '',
                        nameSuffix: user.name?.suffix || '',
                    }))}
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
                    importDisabled={hasActiveImport}
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
                            {/* Avatar Upload Section */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
                                <Box sx={{ position: 'relative' }}>
                                    <Avatar
                                        src={avatarPreview || formData.avatar}
                                        sx={{ width: 120, height: 120 }}
                                    >
                                        {!avatarPreview && !formData.avatar && formData.name.first?.[0]?.toUpperCase()}
                                    </Avatar>
                                    {uploadingAvatar && (
                                        <CircularProgress
                                            size={24}
                                            sx={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                marginTop: '-12px',
                                                marginLeft: '-12px',
                                            }}
                                        />
                                    )}
                                    {(avatarPreview || formData.avatar) && !uploadingAvatar && (
                                        <IconButton
                                            size="small"
                                            sx={{
                                                position: 'absolute',
                                                top: 0,
                                                right: 0,
                                                bgcolor: 'background.paper',
                                                '&:hover': { bgcolor: 'error.light' },
                                            }}
                                            onClick={handleRemoveAvatar}
                                        >
                                            <Close fontSize="small" />
                                        </IconButton>
                                    )}
                                </Box>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    startIcon={<PhotoCamera />}
                                    disabled={uploadingAvatar}
                                >
                                    {avatarPreview || formData.avatar ? 'Change Avatar' : 'Upload Avatar'}
                                    <input
                                        type="file"
                                        hidden
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                    />
                                </Button>
                                <Typography variant="caption" color="text.secondary">
                                    Recommended: Square image, max 10MB
                                </Typography>
                            </Box>

                            <TextField
                                label="User ID"
                                value={formData.uid.trim()}
                                onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                                error={!!formErrors.uid}
                                helperText={formErrors.uid || 'Unique user identifier'}
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
                                value={formData.department || ''}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                fullWidth
                            />
                            <TextField
                                label="Course"
                                value={formData.course || ''}
                                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
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
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog} disabled={saving || uploadingAvatar}>Cancel</Button>
                        <Button onClick={handleSave} variant="contained" disabled={saving || uploadingAvatar}>
                            {uploadingAvatar
                                ? 'Uploading Avatar...'
                                : saving
                                    ? 'Saving...'
                                    : editMode
                                        ? 'Save Changes'
                                        : 'Create User'}
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
