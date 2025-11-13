import * as React from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import GroupsIcon from '@mui/icons-material/Groups';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../../../components/Animate';
import UnauthorizedNotice from '../../../layouts/UnauthorizedNotice';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import type { NavigationItem } from '../../../types/navigation';
import type { ThesisGroup, ThesisGroupFormData } from '../../../types/group';
import type { Session } from '../../../types/session';
import type { UserProfile } from '../../../types/profile';
import {
    getAllUsers,
    getAllGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    setGroup,
    getUsersByFilter,
} from '../../../utils/firebase/firestore';
import { importGroupsFromCsv, exportGroupsToCsv } from '../../../utils/csv/group';
import { useBackgroundJobControls, useBackgroundJobFlag } from '../../../hooks/useBackgroundJobs';
import GroupCard from '../../../components/Group/GroupCard';
import GroupManageDialog, { type GroupFormErrorKey } from '../../../components/Group/GroupManageDialog';
import GroupDeleteDialog from '../../../components/Group/GroupDeleteDialog';
import { GroupView } from '../../../components/Group/GroupView';

export const metadata: NavigationItem = {
    group: 'management',
    index: 1,
    title: 'Groups',
    segment: 'group-management',
    icon: <GroupsIcon />,
    roles: ['admin', 'developer'],
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
    course: '',
};

type CourseValidationReason = 'missingCourse' | 'mismatch' | 'unresolvedStudent';

interface CourseValidationResult {
    course?: string;
    error?: string;
    reason?: CourseValidationReason;
}

const createStudentFilterKey = (department: string, course?: string | null) =>
    `${department.toLowerCase()}::${(course ?? '').toLowerCase()}`;

/**
 * Admin page for managing thesis groups
 */
export default function AdminGroupManagementPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const { startJob } = useBackgroundJobControls();
    const userRole = session?.user?.role;
    const canManage = userRole === 'admin' || userRole === 'developer';

    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [manageDialogOpen, setManageDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [viewGroup, setViewGroup] = React.useState<ThesisGroup | null>(null);
    const [editMode, setEditMode] = React.useState(false);
    const [formData, setFormData] = React.useState<ThesisGroupFormData>({ ...emptyFormData });
    const [activeStep, setActiveStep] = React.useState(0);
    const formSteps = React.useMemo(() => ['Group Details', 'Team', 'Review'], []);
    const [selectedGroup, setSelectedGroup] = React.useState<ThesisGroup | null>(null);
    const [formErrors, setFormErrors] = React.useState<Partial<Record<GroupFormErrorKey, string>>>({});
    const [saving, setSaving] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [studentOptions, setStudentOptions] = React.useState<UserProfile[]>([]);
    const [studentOptionsLoading, setStudentOptionsLoading] = React.useState(false);
    const lastStudentFilterRef = React.useRef<string | null>(null);

    const isMountedRef = React.useRef(true);
    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Track active group import jobs so we can pause reloads mid-import
    const hasActiveImport = useBackgroundJobFlag(
        React.useCallback((job) => {
            if (job.status !== 'pending' && job.status !== 'running') {
                return false;
            }
            const jobType = job.metadata?.jobType as string | undefined;
            return jobType === 'groups-import';
        }, [])
    );

    // Filter users by role
    const students = React.useMemo(() => users.filter((u) => u.role === 'student'), [users]);
    const advisers = React.useMemo(() => users.filter((u) => u.role === 'adviser'), [users]);
    const editors = React.useMemo(() => users.filter((u) => u.role === 'editor'), [users]);

    const studentLookup = React.useMemo(() => {
        const map = new Map<string, UserProfile>();
        students.forEach((student) => {
            map.set(student.email, student);
        });
        return map;
    }, [students]);

    const departmentOptions = React.useMemo(() => {
        const unique = new Set<string>();
        users.forEach((user) => {
            const department = user.department?.trim();
            if (department) {
                unique.add(department);
            }
        });
        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [users]);

    const usersByEmail = React.useMemo(() => {
        const map = new Map<string, UserProfile>();
        users.forEach((user) => {
            if (user.email) {
                map.set(user.email, user);
            }
        });
        return map;
    }, [users]);

    const fetchStudentOptions = React.useCallback(
        async (department: string, course?: string) => {
            const normalizedDepartment = department.trim();
            if (!normalizedDepartment) {
                setStudentOptions([]);
                return [] as UserProfile[];
            }

            const normalizedCourse = course?.trim() || undefined;

            setStudentOptionsLoading(true);
            try {
                const filteredStudents = await getUsersByFilter({
                    role: 'student',
                    department: normalizedDepartment,
                    course: normalizedCourse,
                });
                setStudentOptions(filteredStudents);
                return filteredStudents;
            } catch (error) {
                console.error('Error filtering students:', error);
                showNotification('Failed to filter students. Please try again.', 'error');
                throw error;
            } finally {
                setStudentOptionsLoading(false);
            }
        },
        [showNotification]
    );

    const requestStudentOptions = React.useCallback(
        (course?: string | null) => {
            const department = formData.department?.trim() ?? '';
            if (!department) {
                lastStudentFilterRef.current = null;
                setStudentOptions([]);
                return Promise.resolve([] as UserProfile[]);
            }

            const normalizedCourse = course?.trim() || undefined;
            const filterKey = createStudentFilterKey(department, normalizedCourse);

            if (lastStudentFilterRef.current === filterKey) {
                return Promise.resolve(studentOptions);
            }

            return fetchStudentOptions(department, normalizedCourse).then((results) => {
                lastStudentFilterRef.current = filterKey;
                return results;
            });
        },
        [fetchStudentOptions, formData.department, studentOptions]
    );

    const computeCourseInfo = React.useCallback(
        (leaderEmail: string, memberEmails: string[]): CourseValidationResult => {
            const participantEmails = [leaderEmail, ...memberEmails].filter((email): email is string => !!email);
            if (participantEmails.length === 0) {
                return {};
            }

            const formatName = (user: UserProfile | undefined) => {
                if (!user) return 'Selected student';
                const parts = [user.name?.first, user.name?.last].filter(Boolean);
                return parts.length > 0 ? parts.join(' ') : user.email;
            };

            const firstStudentEmail = participantEmails[0];
            const firstStudent = studentLookup.get(firstStudentEmail);

            if (!firstStudent) {
                return {
                    error: 'Unable to resolve the student profile to determine the course.',
                    reason: 'unresolvedStudent',
                };
            }

            const firstCourse = firstStudent.course?.trim();
            if (!firstCourse) {
                return {
                    error: `${formatName(firstStudent)} does not have a course assigned.`,
                    reason: 'missingCourse',
                };
            }

            for (const email of participantEmails.slice(1)) {
                const student = studentLookup.get(email);
                if (!student) {
                    return {
                        course: firstCourse,
                        error: 'Unable to resolve one of the student profiles to validate the group course.',
                        reason: 'unresolvedStudent',
                    };
                }

                const candidateCourse = student.course?.trim();
                if (!candidateCourse) {
                    return {
                        course: firstCourse,
                        error: `${formatName(student)} does not have a course assigned.`,
                        reason: 'missingCourse',
                    };
                }

                if (candidateCourse !== firstCourse) {
                    return {
                        course: firstCourse,
                        error: 'All student members must be enrolled in the same course.',
                        reason: 'mismatch',
                    };
                }
            }

            return { course: firstCourse };
        },
        [studentLookup]
    );

    const loadData = React.useCallback(async () => {
        if (hasActiveImport) {
            return;
        }
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
    }, [showNotification, hasActiveImport]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = React.useCallback(() => {
        loadData();
    }, [loadData]);

    const handleFormFieldChange = React.useCallback((changes: Partial<ThesisGroupFormData>) => {
        setFormData((prev) => ({ ...prev, ...changes }));

        // Clear validation errors for fields that are being changed and are now valid
        setFormErrors((prevErrors) => {
            const nextErrors = { ...prevErrors };
            let hasChanges = false;

            // Clear department error if a valid department is provided
            if (Object.prototype.hasOwnProperty.call(changes, 'department')) {
                const departmentValue = changes.department;
                if (typeof departmentValue === 'string' && departmentValue.trim()) {
                    if (nextErrors.department) {
                        delete nextErrors.department;
                        hasChanges = true;
                    }
                }
            }

            // Clear name error if a valid name is provided
            if (Object.prototype.hasOwnProperty.call(changes, 'name')) {
                const nameValue = changes.name;
                if (typeof nameValue === 'string' && nameValue.trim()) {
                    if (nextErrors.name) {
                        delete nextErrors.name;
                        hasChanges = true;
                    }
                }
            }

            return hasChanges ? nextErrors : prevErrors;
        });

        if (Object.prototype.hasOwnProperty.call(changes, 'department')) {
            setStudentOptions([]);
            lastStudentFilterRef.current = null;
        }
    }, []);

    const handleOpenCreateDialog = React.useCallback(() => {
        setEditMode(false);
        setSelectedGroup(null);
        setFormData({ ...emptyFormData });
        setFormErrors({});
        setActiveStep(0);
        setStudentOptions([]);
        setStudentOptionsLoading(false);
        lastStudentFilterRef.current = null;
        setManageDialogOpen(true);
    }, []);

    const handleOpenEditDialog = React.useCallback(
        (group: ThesisGroup) => {
            setEditMode(true);
            setSelectedGroup(group);
            setViewGroup(null);
            const sanitizedMembers = Array.from(
                new Set((group.members.members || []).filter((email) => email && email !== group.members.leader))
            );
            const derivedCourse = computeCourseInfo(group.members.leader, sanitizedMembers).course;
            setFormData({
                id: group.id,
                name: group.name,
                description: group.description,
                leader: group.members.leader,
                members: sanitizedMembers,
                adviser: group.members.adviser ?? '',
                editor: group.members.editor ?? '',
                status: group.status,
                thesisTitle: group.thesisTitle,
                department: group.department,
                course: group.course || derivedCourse || '',
            });
            setFormErrors({});
            setActiveStep(0);
            setStudentOptions([]);
            setStudentOptionsLoading(false);
            lastStudentFilterRef.current = null;
            setManageDialogOpen(true);
        },
        [computeCourseInfo]
    );

    const handleOpenDeleteDialog = React.useCallback((group: ThesisGroup) => {
        setSelectedGroup(group);
        setViewGroup(null);
        setDeleteDialogOpen(true);
    }, []);

    const handleCloseManageDialog = React.useCallback(() => {
        setManageDialogOpen(false);
        setSelectedGroup(null);
        setFormData({ ...emptyFormData });
        setFormErrors({});
        setActiveStep(0);
        setSaving(false);
        setStudentOptions([]);
        setStudentOptionsLoading(false);
        lastStudentFilterRef.current = null;
    }, []);

    const handleCloseDeleteDialog = React.useCallback(() => {
        setDeleteDialogOpen(false);
        setSelectedGroup(null);
        setSaving(false);
    }, []);

    const handleCloseView = React.useCallback(() => {
        setViewGroup(null);
    }, []);

    const collectErrorsForStep = React.useCallback((step: number): Partial<Record<GroupFormErrorKey, string>> => {
        const errors: Partial<Record<GroupFormErrorKey, string>> = {};

        if (step === 0) {
            if (!formData.name.trim()) {
                errors.name = 'Group name is required';
            }

            if (!formData.department?.trim()) {
                errors.department = 'Department is required';
            }
        }

        if (step === 1) {
            if (!formData.leader) {
                errors.leader = 'Group leader is required';
            }

            const courseCheck = computeCourseInfo(formData.leader, formData.members);
            if (courseCheck.error) {
                errors.members = courseCheck.error;
            }
        }

        return errors;
    }, [computeCourseInfo, formData.department, formData.leader, formData.members, formData.name]);

    const validateStep = React.useCallback((step: number): boolean => {
        const errors = collectErrorsForStep(step);
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }, [collectErrorsForStep]);

    const applyMemberError = React.useCallback((message?: string) => {
        setFormErrors((prev) => {
            if (message) {
                return { ...prev, members: message };
            }

            if (prev.members) {
                const next = { ...prev };
                delete next.members;
                return next;
            }

            return prev;
        });
    }, []);

    const handleNextStep = React.useCallback(async () => {
        if (!validateStep(activeStep)) {
            return;
        }

        if (activeStep === 0) {
            try {
                await requestStudentOptions(null);
                setActiveStep(1);
            } catch {
                // notification handled inside requestStudentOptions
            }
            return;
        }

        setActiveStep((prev) => Math.min(prev + 1, formSteps.length - 1));
    }, [activeStep, formSteps.length, requestStudentOptions, validateStep]);

    const handleBackStep = React.useCallback(() => {
        setActiveStep((prev) => Math.max(prev - 1, 0));
    }, []);

    const handleLeaderChange = React.useCallback(
        (newValue: UserProfile | null) => {
            const nextLeader = newValue?.email ?? '';
            const filteredMembers = formData.members.filter((email) => email !== nextLeader);
            const courseResult = computeCourseInfo(nextLeader, filteredMembers);

            // Don't show "missing course" errors immediately during selection
            // The validation will catch it when they try to proceed
            if (courseResult.reason === 'missingCourse') {
                applyMemberError(undefined);
            } else {
                applyMemberError(courseResult.error);
            }

            setFormData((prev) => ({
                ...prev,
                leader: nextLeader,
                members: filteredMembers,
                course: courseResult.course ?? '',
            }));
        },
        [applyMemberError, computeCourseInfo, formData.members]
    );

    const handleMembersChange = React.useCallback(
        (selectedUsers: UserProfile[]) => {
            const nextMemberEmails = Array.from(new Set(selectedUsers.map((user) => user.email)));
            const courseResult = computeCourseInfo(formData.leader, nextMemberEmails);

            applyMemberError(courseResult.error);

            if (courseResult.reason === 'mismatch') {
                showNotification(
                    courseResult.error ?? 'All student members must be enrolled in the same course.',
                    'warning',
                    6000
                );
                return;
            }

            // Don't show "missing course" errors immediately - let users add members first
            // The validation will catch it when they try to proceed
            if (courseResult.reason === 'missingCourse') {
                applyMemberError(undefined); // Clear the error for now
            }

            setFormData((prev) => ({
                ...prev,
                members: nextMemberEmails,
                course: courseResult.course ?? '',
            }));
        },
        [applyMemberError, computeCourseInfo, formData.leader, showNotification]
    );

    React.useEffect(() => {
        if (!manageDialogOpen || activeStep !== 1) {
            return;
        }

        const department = formData.department?.trim();
        if (!department) {
            setStudentOptions([]);
            lastStudentFilterRef.current = null;
            return;
        }

        const hasSelection = Boolean(formData.leader || formData.members.length);
        if (!hasSelection) {
            void requestStudentOptions(null);
            return;
        }

        const result = computeCourseInfo(formData.leader, formData.members);
        if (result.reason === 'mismatch') {
            return;
        }

        void requestStudentOptions(result.course ?? null);
    }, [
        activeStep,
        computeCourseInfo,
        formData.department,
        formData.leader,
        formData.members,
        manageDialogOpen,
        requestStudentOptions,
    ]);

    const formatUserLabel = React.useCallback(
        (email: string | null | undefined): string => {
            if (!email) {
                return '—';
            }

            const user = usersByEmail.get(email);
            if (!user) {
                return email;
            }

            const first = user.name?.first?.trim();
            const last = user.name?.last?.trim();
            const displayName = [first, last].filter(Boolean).join(' ');

            return displayName ? `${displayName} (${user.email})` : user.email;
        },
        [usersByEmail]
    );

    const reviewCourse = React.useMemo(() => {
        const result = computeCourseInfo(formData.leader, formData.members);
        return result.course ?? formData.course ?? '';
    }, [computeCourseInfo, formData.course, formData.leader, formData.members]);

    const memberChipData = React.useMemo(
        () => formData.members.map((email) => ({ email, label: formatUserLabel(email) })),
        [formData.members, formatUserLabel]
    );

    const handleSave = async () => {
        const step0Errors = collectErrorsForStep(0);
        const step1Errors = collectErrorsForStep(1);
        const aggregatedErrors: Partial<Record<GroupFormErrorKey, string>> = {
            ...step0Errors,
            ...step1Errors,
        };

        setFormErrors(aggregatedErrors);

        if (Object.keys(step0Errors).length > 0) {
            setActiveStep(0);
            return;
        }

        if (Object.keys(step1Errors).length > 0) {
            setActiveStep(1);
            return;
        }

        const normalizedDepartment = formData.department?.trim();
        const courseInfo = computeCourseInfo(formData.leader, formData.members);
        const normalizedCourse = courseInfo.course?.trim() ?? '';

        setSaving(true);
        try {
            if (!editMode) {
                // Create new group
                const newGroupData: Omit<ThesisGroup, 'id' | 'createdAt' | 'updatedAt'> = {
                    name: formData.name.trim(),
                    description: formData.description?.trim(),
                    members: {
                        leader: formData.leader,
                        members: formData.members,
                        adviser: formData.adviser || undefined,
                        editor: formData.editor || undefined,
                    },
                    status: formData.status,
                    thesisTitle: formData.thesisTitle?.trim(),
                    department: normalizedDepartment || '',
                    course: normalizedCourse,
                };

                // Save to Firestore
                const createdGroup = await createGroup(newGroupData);
                setGroups((prev) => [...prev, createdGroup]);
                showNotification(`Group "${createdGroup.name}" created successfully`, 'success');
            } else {
                // Update existing group
                if (!selectedGroup) return;

                const updates: Partial<ThesisGroup> = {
                    name: formData.name.trim(),
                    description: formData.description?.trim(),
                    members: {
                        leader: formData.leader,
                        members: formData.members,
                        adviser: formData.adviser || undefined,
                        editor: formData.editor || undefined,
                        panels: selectedGroup.members.panels,
                    },
                    status: formData.status,
                    thesisTitle: formData.thesisTitle?.trim(),
                    department: normalizedDepartment || '',
                    course: normalizedCourse,
                };

                // Update in Firestore
                await updateGroup(selectedGroup.id, updates);
                const updatedGroup: ThesisGroup = {
                    ...selectedGroup,
                    ...updates,
                    members: updates.members ?? selectedGroup.members,
                    updatedAt: new Date().toISOString(),
                };
                setGroups((prev) => prev.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)));
                showNotification(`Group "${updatedGroup.name}" updated successfully`, 'success');
            }

            handleCloseManageDialog();
        } catch (error) {
            console.error('Error saving group:', error);
            showNotification('Failed to save group. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = React.useCallback(async () => {
        if (!selectedGroup) return;

        setSaving(true);
        try {
            await deleteGroup(selectedGroup.id);
            setGroups((prev) => prev.filter((group) => group.id !== selectedGroup.id));
            showNotification(`Group "${selectedGroup.name}" deleted successfully`, 'success');
            handleCloseDeleteDialog();
        } catch (error) {
            console.error('Error deleting group:', error);
            showNotification('Failed to delete group. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    }, [handleCloseDeleteDialog, selectedGroup, showNotification]);

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

    const handleImport = React.useCallback(
        async (file: File) => {
            startJob(
                `Importing groups from ${file.name}`,
                async (updateProgress, signal) => {
                    const text = await file.text();
                    if (signal.aborted) {
                        throw new Error('Import cancelled');
                    }

                    const { parsed: importedGroups, errors: parseErrors } = importGroupsFromCsv(text);

                    const errors: string[] = [];
                    if (parseErrors.length) {
                        errors.push(...parseErrors.map((e: string) => `Parse: ${e}`));
                    }

                    if (signal.aborted) {
                        throw new Error('Import cancelled');
                    }

                    const total = importedGroups.length;
                    let successCount = 0;

                    for (let i = 0; i < importedGroups.length; i++) {
                        if (signal.aborted) {
                            throw new Error('Import cancelled');
                        }

                        const groupData = importedGroups[i];
                        if (total > 0) {
                            updateProgress({
                                current: i + 1,
                                total,
                                message: `Creating group ${groupData.name || `#${i + 1}`}`,
                            });
                        }

                        try {
                            const fallbackId = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                            const groupId = (groupData as Partial<ThesisGroup>).id || fallbackId;
                            await setGroup(groupId, {
                                ...groupData,
                                id: groupId,
                            });
                            successCount++;
                        } catch (importError) {
                            const identifier = groupData.name || groupData.id || `row ${i + 2}`;
                            const importMessage =
                                importError instanceof Error ? importError.message : 'Unknown error';
                            errors.push(
                                `Failed to import ${identifier}: ${importMessage}`
                            );
                        }
                    }

                    return {
                        count: successCount,
                        errors,
                        total,
                    };
                },
                { fileName: file.name, fileSize: file.size, jobType: 'groups-import' },
                (job) => {
                    if (isMountedRef.current) {
                        (async () => {
                            try {
                                setLoading(true);
                                const [allUsers, groupsData] = await Promise.all([
                                    getAllUsers(),
                                    getAllGroups(),
                                ]);
                                setUsers(allUsers);
                                setGroups(groupsData);
                            } catch {
                                // handled via notifications below
                            } finally {
                                setLoading(false);
                            }
                        })();
                    }

                    if (job.status === 'completed' && job.result) {
                        const result = job.result as { count: number; errors: string[]; total: number };
                        if (result.errors.length > 0) {
                            showNotification(
                                `Imported ${result.count} of ${result.total} group(s) with warnings`,
                                'warning',
                                6000,
                                {
                                    label: 'View Details',
                                    onClick: () =>
                                        showNotification(`Import warnings:\n${result.errors.join('\n')}`, 'info', 0),
                                }
                            );
                        } else {
                            showNotification(`Successfully imported ${result.count} group(s)`, 'success');
                        }
                    } else if (job.status === 'failed') {
                        showNotification(`Group import failed: ${job.error}`, 'error');
                    }
                }
            );

            showNotification('Group import started in the background.', 'info', 5000);
        },
        [showNotification, startJob]
    );

    const handleImportButtonClick = React.useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileInputChange = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) {
                void handleImport(file);
            }
            event.target.value = '';
        },
        [handleImport]
    );

    if (!canManage) {
        return (
            <AnimatedPage variant="fade">
                <UnauthorizedNotice description="You need to be an administrator or developer to manage groups." />
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ width: '100%', py: 3 }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    justifyContent="space-between"
                    sx={{ mb: 3 }}
                >
                    <Box>
                        <Typography variant="h4" sx={{ mb: 0.5 }}>
                            Thesis Groups
                        </Typography>
                        <Typography color="text.secondary">
                            Manage thesis teams, review membership, and coordinate advisers.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            Refresh
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<FileDownloadIcon />}
                            onClick={() => handleExport(groups)}
                            disabled={loading || groups.length === 0}
                        >
                            Export
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<CloudUploadIcon />}
                            onClick={handleImportButtonClick}
                            disabled={hasActiveImport}
                        >
                            Import
                        </Button>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
                            New Group
                        </Button>
                    </Stack>
                </Stack>

                <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    accept=".csv,text/csv"
                    onChange={handleFileInputChange}
                />

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                        <CircularProgress />
                    </Box>
                ) : groups.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography variant="h6" gutterBottom>
                            No groups yet
                        </Typography>
                        <Typography color="text.secondary">
                            Create a group to start tracking thesis progress.
                        </Typography>
                    </Box>
                ) : (
                    <Grid container spacing={3}>
                        {groups.map((group) => (
                            <Grid key={group.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                <GroupCard
                                    group={group}
                                    usersByEmail={usersByEmail}
                                    onClick={setViewGroup}
                                    onEdit={handleOpenEditDialog}
                                    onDelete={handleOpenDeleteDialog}
                                    canManage={canManage}
                                />
                            </Grid>
                        ))}
                    </Grid>
                )}

                <GroupManageDialog
                    open={manageDialogOpen}
                    editMode={editMode}
                    activeStep={activeStep}
                    steps={formSteps}
                    formData={formData}
                    formErrors={formErrors}
                    students={studentOptions}
                    advisers={advisers}
                    editors={editors}
                    departmentOptions={departmentOptions}
                    memberChipData={memberChipData}
                    reviewCourse={reviewCourse}
                    saving={saving}
                    studentLoading={studentOptionsLoading}
                    onClose={handleCloseManageDialog}
                    onFieldChange={handleFormFieldChange}
                    onLeaderChange={handleLeaderChange}
                    onMembersChange={handleMembersChange}
                    onNext={handleNextStep}
                    onBack={handleBackStep}
                    onSubmit={handleSave}
                    formatUserLabel={formatUserLabel}
                />

                <GroupDeleteDialog
                    open={deleteDialogOpen}
                    group={selectedGroup}
                    onCancel={handleCloseDeleteDialog}
                    onConfirm={handleDelete}
                    loading={saving}
                />

                <GroupView
                    open={!!viewGroup}
                    group={viewGroup}
                    usersByEmail={usersByEmail}
                    onClose={handleCloseView}
                    onEdit={handleOpenEditDialog}
                    onDelete={handleOpenDeleteDialog}
                    canManage={canManage}
                />
            </Box>
        </AnimatedPage>
    );
}
