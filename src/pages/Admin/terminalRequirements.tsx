import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Card, CardContent, CircularProgress,
    Grid, IconButton, Stack, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import {
    FactCheck as FactCheckIcon, Upload as UploadIcon, Delete as DeleteIcon,
    Add as AddIcon, Edit as EditIcon
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../../components/Animate';
import { useSnackbar } from '../../components/Snackbar';
import { RequirementDialog, type RequirementDialogData } from '../../components/TerminalRequirements';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisStageName } from '../../types/thesis';
import type {
    TerminalRequirementConfigEntry, TerminalRequirementFileTemplate
} from '../../types/terminalRequirementTemplate';
import { findUserById, findAllUsers } from '../../utils/firebase/firestore/user';
import { getGroupsByDepartment, getGroupDepartments } from '../../utils/firebase/firestore/groups';
import { listDepartmentsForYear, listCoursesForDepartment } from '../../utils/firebase/firestore/courseTemplateHelpers';
import {
    getAllTerminalRequirementConfigs, getTerminalRequirementConfig, setTerminalRequirementConfig
} from '../../utils/firebase/firestore/terminalRequirements';
import {
    uploadTerminalRequirementTemplate, deleteTerminalRequirementTemplate
} from '../../utils/firebase/storage/terminalRequirements';
import { THESIS_STAGE_METADATA } from '../../utils/thesisStageUtils';
import { DEFAULT_YEAR } from '../../config/firestore';

type RequirementStateMap = Record<string, TerminalRequirementConfigEntry>;

/**
 * Create an empty requirement state - admins build from scratch
 */
function createEmptyRequirementState(): RequirementStateMap {
    return {};
}

/**
 * Convert entries array from Firestore to a map
 */
function entriesToState(entries?: TerminalRequirementConfigEntry[]): RequirementStateMap {
    if (!entries || entries.length === 0) {
        return {};
    }
    return entries.reduce<RequirementStateMap>((acc, entry) => {
        if (!entry.requirementId) {
            return acc;
        }
        acc[entry.requirementId] = {
            stage: entry.stage,
            requirementId: entry.requirementId,
            required: Boolean(entry.required),
            ...(entry.title ? { title: entry.title } : {}),
            ...(entry.description ? { description: entry.description } : {}),
            ...(entry.requireAttachment !== undefined ? { requireAttachment: entry.requireAttachment } : {}),
            ...(entry.fileTemplate ? { fileTemplate: { ...entry.fileTemplate } } : {}),
        };
        return acc;
    }, {});
}

function cloneRequirementState(state: RequirementStateMap): RequirementStateMap {
    return Object.keys(state).reduce<RequirementStateMap>((acc, key) => {
        const entry = state[key];
        acc[key] = {
            stage: entry.stage,
            requirementId: entry.requirementId,
            required: entry.required,
            ...(entry.title ? { title: entry.title } : {}),
            ...(entry.description ? { description: entry.description } : {}),
            ...(entry.requireAttachment !== undefined ? { requireAttachment: entry.requireAttachment } : {}),
            ...(entry.fileTemplate ? { fileTemplate: { ...entry.fileTemplate } } : {}),
        };
        return acc;
    }, {});
}

function areRequirementStatesEqual(a: RequirementStateMap, b: RequirementStateMap): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    return aKeys.every((key) => {
        const entryA = a[key];
        const entryB = b[key];
        if (!entryA || !entryB) {
            return false;
        }
        const sameTemplate = entryA.fileTemplate?.fileId === entryB.fileTemplate?.fileId
            && entryA.fileTemplate?.fileUrl === entryB.fileTemplate?.fileUrl
            && entryA.fileTemplate?.fileName === entryB.fileTemplate?.fileName
            && entryA.fileTemplate?.uploadedAt === entryB.fileTemplate?.uploadedAt
            && entryA.fileTemplate?.uploadedBy === entryB.fileTemplate?.uploadedBy;
        return entryA.required === entryB.required
            && entryA.stage === entryB.stage
            && entryA.title === entryB.title
            && entryA.description === entryB.description
            && entryA.requireAttachment === entryB.requireAttachment
            && sameTemplate;
    });
}


export const metadata: NavigationItem = {
    group: 'management',
    index: 5,
    title: 'Terminal Requirements',
    segment: 'admin-terminal-requirements',
    icon: <FactCheckIcon />,
    roles: ['admin', 'developer'],
};

export default function AdminTerminalRequirementsPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? '';
    const { showNotification } = useSnackbar();

    const canManage = session?.user?.role === 'admin' || session?.user?.role === 'developer';

    const [selectedYear] = React.useState(DEFAULT_YEAR);
    const [profileLoading, setProfileLoading] = React.useState(true);
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = React.useState('');

    const [courseOptions, setCourseOptions] = React.useState<string[]>([]);
    const [coursesLoading, setCoursesLoading] = React.useState(false);
    const [selectedCourse, setSelectedCourse] = React.useState('');

    const [configLoading, setConfigLoading] = React.useState(false);
    const [configError, setConfigError] = React.useState<string | null>(null);

    const [requirementState, setRequirementState] = React.useState<RequirementStateMap>(() => createEmptyRequirementState());
    const syncedStateRef = React.useRef<RequirementStateMap>(createEmptyRequirementState());

    const [activeStage, setActiveStage] = React.useState<ThesisStageName>(THESIS_STAGE_METADATA[0].value);
    const [saving, setSaving] = React.useState(false);
    const [uploadingMap, setUploadingMap] = React.useState<Record<string, boolean>>({});
    const [removingMap, setRemovingMap] = React.useState<Record<string, boolean>>({});

    // Add requirement dialog state
    const [addDialogOpen, setAddDialogOpen] = React.useState(false);

    // Edit requirement dialog state
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [editingEntry, setEditingEntry] = React.useState<TerminalRequirementConfigEntry | null>(null);

    const stageLabelMap = React.useMemo<Record<ThesisStageName, string>>(() => {
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, string>>((acc, stage) => {
            acc[stage.value as ThesisStageName] = stage.label;
            return acc;
        }, {} as Record<ThesisStageName, string>);
    }, []);

    const hasUnsavedChanges = React.useMemo(() => {
        return !areRequirementStatesEqual(requirementState, syncedStateRef.current);
    }, [requirementState]);

    React.useEffect(() => {
        if (!canManage || !userUid) {
            setProfileLoading(false);
            setDepartments([]);
            setSelectedDepartment('');
            return;
        }

        let cancelled = false;
        setProfileLoading(true);

        const loadDepartments = async () => {
            try {
                const [profile, allConfigs, groupDepartments, hierarchyDepartments, allUsers] = await Promise.all([
                    findUserById(userUid),
                    getAllTerminalRequirementConfigs(selectedYear).catch(() => []),
                    getGroupDepartments().catch(() => []),
                    listDepartmentsForYear(selectedYear).catch(() => []),
                    findAllUsers().catch(() => []),
                ]);

                if (cancelled) {
                    return;
                }

                const managedDepartments = profile?.departments?.filter(Boolean)
                    ?? (profile?.department ? [profile.department] : []);

                const normalizedManaged = managedDepartments
                    .map((dept: string) => dept.trim())
                    .filter((dept: string): dept is string => Boolean(dept));
                normalizedManaged.sort((a: string, b: string) => a.localeCompare(b));

                // Extract departments from all terminal requirement configs
                const knownDepartments = new Set<string>();
                allConfigs.forEach((config) => {
                    if (config.department) {
                        knownDepartments.add(config.department.trim());
                    }
                });
                const normalizedKnown = Array.from(knownDepartments);

                const normalizedFromGroups = groupDepartments
                    .map((dept: string) => dept.trim())
                    .filter((dept: string): dept is string => Boolean(dept));

                const normalizedFromHierarchy = hierarchyDepartments
                    .map((dept: string) => dept.trim())
                    .filter((dept: string): dept is string => Boolean(dept));

                // Extract departments from user profiles (like Groups page does)
                const normalizedFromUsers = allUsers
                    .map((user) => user.department?.trim())
                    .filter((dept): dept is string => Boolean(dept));

                const unique = new Set<string>([
                    ...normalizedKnown,
                    ...normalizedManaged,
                    ...normalizedFromGroups,
                    ...normalizedFromHierarchy,
                    ...normalizedFromUsers,
                ]);
                const sortedDepartments = Array.from(unique).sort((a, b) => a.localeCompare(b));
                setDepartments(sortedDepartments);

                const fallback = normalizedManaged[0] ?? sortedDepartments[0] ?? '';
                setSelectedDepartment((current) => {
                    if (current && current.trim()) {
                        const trimmed = current.trim();
                        return unique.has(trimmed) ? trimmed : current;
                    }
                    return fallback;
                });
            } catch (error) {
                console.error('Failed to load terminal requirement departments:', error);
                if (!cancelled) {
                    showNotification('Failed to load available departments.', 'error');
                    setDepartments([]);
                    setSelectedDepartment('');
                }
            } finally {
                if (!cancelled) {
                    setProfileLoading(false);
                }
            }
        };

        void loadDepartments();

        return () => {
            cancelled = true;
        };
    }, [canManage, selectedYear, showNotification, userUid]);

    React.useEffect(() => {
        setSelectedCourse('');
    }, [selectedDepartment]);

    React.useEffect(() => {
        if (!selectedDepartment) {
            setCourseOptions([]);
            setSelectedCourse('');
            return;
        }

        let cancelled = false;
        setCoursesLoading(true);

        const loadCourses = async () => {
            try {
                const [groups, allConfigs, hierarchyCourses, allUsers] = await Promise.all([
                    getGroupsByDepartment(selectedDepartment),
                    getAllTerminalRequirementConfigs(selectedYear).catch(() => []),
                    listCoursesForDepartment(selectedYear, selectedDepartment).catch(() => []),
                    findAllUsers().catch(() => []),
                ]);

                if (cancelled) {
                    return;
                }

                // Filter configs by department
                const filteredConfigs = allConfigs.filter(
                    (config) => config.department?.toLowerCase() === selectedDepartment.toLowerCase()
                );

                const fromGroups = groups
                    .map((group) => group.course?.trim())
                    .filter((course): course is string => Boolean(course));

                const fromConfigs = filteredConfigs
                    .map((config) => config.course?.trim())
                    .filter((course): course is string => Boolean(course));

                const fromHierarchy = hierarchyCourses
                    .map((course: string) => course.trim())
                    .filter((course): course is string => Boolean(course));

                // Extract courses from user profiles for the selected department (like Groups page does)
                const fromUsers = allUsers
                    .filter((user) => user.department?.trim() === selectedDepartment)
                    .map((user) => user.course?.trim())
                    .filter((course): course is string => Boolean(course));

                const uniqueCourses = Array.from(
                    new Set([...fromGroups, ...fromConfigs, ...fromHierarchy, ...fromUsers])
                ).sort((a, b) => a.localeCompare(b));
                setCourseOptions(uniqueCourses);
                setSelectedCourse((current) => {
                    if (current.trim()) {
                        return current.trim();
                    }
                    return uniqueCourses[0] ?? '';
                });
            } catch (error) {
                console.error('Failed to load courses for department:', error);
                if (!cancelled) {
                    showNotification('Failed to load courses for this department.', 'error');
                    setCourseOptions([]);
                    setSelectedCourse('');
                }
            } finally {
                if (!cancelled) {
                    setCoursesLoading(false);
                }
            }
        };

        void loadCourses();

        return () => {
            cancelled = true;
        };
    }, [selectedDepartment, selectedYear, showNotification]);

    React.useEffect(() => {
        if (!selectedDepartment || !selectedCourse) {
            const empty = createEmptyRequirementState();
            setRequirementState(empty);
            syncedStateRef.current = cloneRequirementState(empty);
            return;
        }

        let cancelled = false;
        setConfigLoading(true);
        setConfigError(null);

        void getTerminalRequirementConfig({
            year: selectedYear,
            department: selectedDepartment,
            course: selectedCourse,
        })
            .then((config) => {
                if (cancelled) {
                    return;
                }
                const nextState = entriesToState(config?.requirements);
                setRequirementState(nextState);
                syncedStateRef.current = cloneRequirementState(nextState);
            })
            .catch((error) => {
                console.error('Failed to load terminal requirements config:', error);
                if (!cancelled) {
                    setConfigError('Unable to load terminal requirements for the selected course.');
                    const empty = createEmptyRequirementState();
                    setRequirementState(empty);
                    syncedStateRef.current = cloneRequirementState(empty);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setConfigLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedCourse, selectedDepartment, selectedYear]);

    const persistConfig = React.useCallback(async (
        nextRequirements: RequirementStateMap,
        options?: { silent?: boolean },
    ): Promise<boolean> => {
        if (!selectedDepartment || !selectedCourse) {
            showNotification('Select a department and course before saving.', 'error');
            return false;
        }

        const shouldShowLoader = !options?.silent;
        if (shouldShowLoader) {
            setSaving(true);
        }

        try {
            await setTerminalRequirementConfig({
                year: selectedYear,
                department: selectedDepartment,
                course: selectedCourse,
                requirements: Object.values(nextRequirements),
            });
            return true;
        } catch (error) {
            console.error('Failed to save terminal requirements config:', error);
            showNotification('Failed to save terminal requirements.', 'error');
            return false;
        } finally {
            if (shouldShowLoader) {
                setSaving(false);
            }
        }
    }, [selectedCourse, selectedDepartment, selectedYear, showNotification]);

    const handleSave = React.useCallback(async () => {
        const success = await persistConfig(requirementState);
        if (success) {
            syncedStateRef.current = cloneRequirementState(requirementState);
            showNotification('Terminal requirements saved.', 'success');
        }
    }, [persistConfig, requirementState, showNotification]);

    const handleToggleRequirement = React.useCallback((requirementId: string, nextRequired: boolean) => {
        setRequirementState((prev) => {
            const current = prev[requirementId];
            if (!current || current.required === nextRequired) {
                return prev;
            }
            const nextState = { ...prev, [requirementId]: { ...current, required: nextRequired } };
            return nextState;
        });
    }, []);

    const handleDeleteRequirement = React.useCallback((requirementId: string) => {
        setRequirementState((prev) => {
            const nextState = { ...prev };
            delete nextState[requirementId];
            return nextState;
        });
    }, []);

    const handleAddRequirement = React.useCallback((data: RequirementDialogData) => {
        if (!data.title.trim()) {
            showNotification('Please enter a title for the requirement.', 'error');
            return;
        }

        const requirementId = `${activeStage.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
        const newEntry: TerminalRequirementConfigEntry = {
            stage: activeStage,
            requirementId,
            required: data.required ?? true,
            title: data.title.trim(),
            description: data.description.trim() || undefined,
        };

        setRequirementState((prev) => ({
            ...prev,
            [requirementId]: newEntry,
        }));

        setAddDialogOpen(false);
        showNotification('Requirement added. Remember to save your changes.', 'info');
    }, [activeStage, showNotification]);

    const handleOpenEditDialog = React.useCallback((entry: TerminalRequirementConfigEntry) => {
        setEditingEntry(entry);
        setEditDialogOpen(true);
    }, []);

    const handleSaveEdit = React.useCallback((data: RequirementDialogData) => {
        if (!editingEntry) {
            return;
        }

        setRequirementState((prev) => {
            const current = prev[editingEntry.requirementId];
            if (!current) return prev;
            return {
                ...prev,
                [editingEntry.requirementId]: {
                    ...current,
                    title: data.title.trim(),
                    description: data.description.trim() || undefined,
                },
            };
        });

        setEditDialogOpen(false);
        setEditingEntry(null);
        showNotification('Requirement updated. Remember to save your changes.', 'info');
    }, [editingEntry, showNotification]);

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, nextStage: ThesisStageName) => {
        setActiveStage(nextStage);
    }, []);

    // Get entries for the current stage from requirementState
    const stageEntries = React.useMemo(() => {
        return Object.values(requirementState).filter((entry) => entry.stage === activeStage);
    }, [activeStage, requirementState]);

    const activeStageLabel = stageLabelMap[activeStage] ?? activeStage;

    const handleTemplateUpload = React.useCallback(async (requirementId: string, file: File) => {
        if (!selectedDepartment || !selectedCourse) {
            showNotification('Pick a department and course first.', 'error');
            return;
        }
        if (!userUid) {
            showNotification('You must be signed in to upload templates.', 'error');
            return;
        }

        setUploadingMap((prev) => ({ ...prev, [requirementId]: true }));
        try {
            const uploadResult = await uploadTerminalRequirementTemplate({
                year: selectedYear,
                file,
                department: selectedDepartment,
                course: selectedCourse,
                requirementId,
                uploadedBy: userUid,
            });

            const metadata: TerminalRequirementFileTemplate = {
                fileId: uploadResult.fileId,
                fileName: uploadResult.fileName,
                fileUrl: uploadResult.fileUrl,
                uploadedAt: new Date().toISOString(),
                uploadedBy: userUid,
            };

            const nextState = cloneRequirementState(requirementState);
            const existing = nextState[requirementId];
            if (!existing) {
                showNotification('Requirement not found.', 'error');
                await deleteTerminalRequirementTemplate(uploadResult.storagePath);
                return;
            }
            nextState[requirementId] = {
                ...existing,
                fileTemplate: metadata,
            };

            const success = await persistConfig(nextState, { silent: true });
            if (success) {
                setRequirementState(nextState);
                syncedStateRef.current = cloneRequirementState(nextState);
                showNotification('Template uploaded.', 'success');
            } else {
                await deleteTerminalRequirementTemplate(uploadResult.storagePath);
            }
        } catch (error) {
            console.error('Failed to upload template:', error);
            showNotification('Failed to upload template. Please try again.', 'error');
        } finally {
            setUploadingMap((prev) => ({ ...prev, [requirementId]: false }));
        }
    }, [
        persistConfig,
        requirementState,
        selectedCourse,
        selectedDepartment,
        selectedYear,
        showNotification,
        userUid,
    ]);

    const handleRemoveTemplate = React.useCallback(async (requirementId: string) => {
        const currentEntry = requirementState[requirementId];
        if (!currentEntry?.fileTemplate) {
            return;
        }

        setRemovingMap((prev) => ({ ...prev, [requirementId]: true }));
        try {
            if (currentEntry.fileTemplate.fileUrl) {
                await deleteTerminalRequirementTemplate(currentEntry.fileTemplate.fileUrl);
            }

            const nextState = cloneRequirementState(requirementState);
            nextState[requirementId] = { ...nextState[requirementId], fileTemplate: undefined };

            const success = await persistConfig(nextState, { silent: true });
            if (success) {
                setRequirementState(nextState);
                syncedStateRef.current = cloneRequirementState(nextState);
                showNotification('Template removed.', 'success');
            }
        } catch (error) {
            console.error('Failed to remove template:', error);
            showNotification('Failed to remove template. Please try again.', 'error');
        } finally {
            setRemovingMap((prev) => ({ ...prev, [requirementId]: false }));
        }
    }, [persistConfig, requirementState, showNotification]);

    const renderRequirementCard = (entry: TerminalRequirementConfigEntry) => {
        const uploading = uploadingMap[entry.requirementId];
        const removing = removingMap[entry.requirementId];
        const hasTemplate = Boolean(entry.fileTemplate);

        const uploadedAtLabel = entry.fileTemplate?.uploadedAt
            ? new Date(entry.fileTemplate.uploadedAt).toLocaleString()
            : null;

        // Use title from entry, or fallback to formatted requirementId
        const displayTitle = entry.title || entry.requirementId
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .replace(/\d+$/, '')
            .trim() || 'Requirement';

        return (
            <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>{displayTitle}</Typography>
                            {entry.description && (
                                <Typography variant="body2" color="text.secondary">
                                    {entry.description}
                                </Typography>
                            )}
                            <Typography variant="caption" color="text.disabled">
                                ID: {entry.requirementId}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                            <IconButton
                                size="small"
                                onClick={() => handleOpenEditDialog(entry)}
                                title="Edit requirement"
                                sx={{ bgcolor: 'action.hover' }}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteRequirement(entry.requirementId)}
                                title="Delete requirement"
                                sx={{ bgcolor: 'action.hover' }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="caption" color="text.secondary">
                                {entry.required ? 'Required' : 'Optional'}
                            </Typography>
                            <Switch
                                checked={entry.required}
                                onChange={(_, checked) => handleToggleRequirement(entry.requirementId, checked)}
                                size="small"
                            />
                        </Stack>
                        <Box sx={{ flexGrow: 1 }} />
                        {(uploading || removing) && <CircularProgress size={20} />}
                        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                            {hasTemplate && (
                                <>
                                    <Button
                                        variant="text"
                                        size="small"
                                        component="a"
                                        href={entry.fileTemplate?.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        View template
                                    </Button>
                                    <Button
                                        variant="text"
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleRemoveTemplate(entry.requirementId)}
                                        disabled={removing}
                                    >
                                        Remove
                                    </Button>
                                </>
                            )}
                            <Button
                                component="label"
                                variant="outlined"
                                size="small"
                                startIcon={<UploadIcon />}
                                disabled={!selectedDepartment || !selectedCourse || uploading}
                            >
                                {uploading ? 'Uploading…' : hasTemplate ? 'Replace' : 'Upload template'}
                                <input
                                    type="file"
                                    hidden
                                    accept=".pdf,.doc,.docx"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                            void handleTemplateUpload(entry.requirementId, file);
                                        }
                                        event.target.value = '';
                                    }}
                                />
                            </Button>
                        </Stack>
                    </Stack>

                    {uploadedAtLabel && (
                        <Typography variant="caption" color="text.secondary">
                            Uploaded on {uploadedAtLabel}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        );
    };

    if (!canManage) {
        return <UnauthorizedNotice title="Terminal Requirements" variant="box" />;
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography color="text.secondary">
                        Choose which forms are required per stage and attach the latest templates for your courses.
                    </Typography>
                </Box>

                <Card variant="outlined">
                    <CardContent>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                            <Autocomplete
                                freeSolo
                                options={departments}
                                value={selectedDepartment}
                                onChange={(_, value) => setSelectedDepartment(value ?? '')}
                                onInputChange={(_, value, reason) => {
                                    if (reason === 'clear') {
                                        setSelectedDepartment('');
                                    }
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Department"
                                        placeholder={profileLoading ? 'Loading...' : 'Select department'}
                                    />
                                )}
                                disabled={profileLoading || departments.length === 0}
                                sx={{ minWidth: 240 }}
                            />
                            <Autocomplete
                                freeSolo
                                options={courseOptions}
                                value={selectedCourse}
                                onChange={(_, value) => setSelectedCourse(value ?? '')}
                                onInputChange={(_, value) => setSelectedCourse(value)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Course"
                                        placeholder={coursesLoading ? 'Loading courses...' : 'Select or type course'}
                                    />
                                )}
                                disabled={!selectedDepartment}
                                sx={{ minWidth: 240 }}
                            />
                            <Box sx={{ flexGrow: 1 }} />
                            <Stack direction="row" spacing={1}>
                                <Button
                                    variant="outlined"
                                    startIcon={<AddIcon />}
                                    onClick={() => setAddDialogOpen(true)}
                                    disabled={!selectedDepartment || !selectedCourse}
                                >
                                    Add Requirement
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleSave}
                                    disabled={saving || !hasUnsavedChanges || !selectedDepartment || !selectedCourse}
                                >
                                    {saving ? 'Saving…' : 'Save changes'}
                                </Button>
                            </Stack>
                        </Stack>
                        {!selectedDepartment && !profileLoading && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                Add at least one department to your profile to manage requirements.
                            </Alert>
                        )}
                        {selectedDepartment && !selectedCourse && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                Select or enter a course to configure its requirements.
                            </Alert>
                        )}
                        {hasUnsavedChanges && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                You have unsaved changes for this course.
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {configError && (
                    <Alert severity="error">{configError}</Alert>
                )}

                {configLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : selectedDepartment && selectedCourse ? (
                    <Stack spacing={2}>
                        <Card variant="outlined">
                            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                                <Tabs
                                    value={activeStage}
                                    onChange={handleStageChange}
                                    variant="scrollable"
                                    scrollButtons
                                    allowScrollButtonsMobile
                                >
                                    {THESIS_STAGE_METADATA.map((stage) => (
                                        <Tab key={stage.value} value={stage.value} label={stage.label} />
                                    ))}
                                </Tabs>
                            </CardContent>
                        </Card>
                        {stageEntries.length === 0 ? (
                            <Alert severity="info">
                                No terminal requirements defined for {activeStageLabel}.
                            </Alert>
                        ) : (
                            <Grid container spacing={2}>
                                {stageEntries.map((entry) => (
                                    <Grid key={entry.requirementId} size={{ xs: 12, sm: 6, md: 4 }}>
                                        {renderRequirementCard(entry)}
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </Stack>
                ) : (
                    <Alert severity="info">
                        Choose a department and course to start configuring terminal requirements.
                    </Alert>
                )}
            </Stack>

            {/* Add Requirement Dialog */}
            <RequirementDialog
                open={addDialogOpen}
                onClose={() => setAddDialogOpen(false)}
                onConfirm={handleAddRequirement}
                mode="add"
                stageLabel={activeStageLabel}
            />

            {/* Edit Requirement Dialog */}
            <RequirementDialog
                open={editDialogOpen}
                onClose={() => {
                    setEditDialogOpen(false);
                    setEditingEntry(null);
                }}
                onConfirm={handleSaveEdit}
                mode="edit"
                initialData={editingEntry ? {
                    title: editingEntry.title ?? '',
                    description: editingEntry.description ?? '',
                } : undefined}
            />
        </AnimatedPage>
    );
}
